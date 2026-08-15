package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateEvaluationAudienceRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAudiencePreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAudienceResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAudience;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationAudienceStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationAudienceRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingGroup;
import vn.vietduc.carehubbackend.training.repository.TrainingGroupRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EvaluationAudienceService {
    private static final int RULE_VERSION = 1;
    private static final int MAX_DEPTH = 8;
    private static final Set<String> TOP_LEVEL_FIELDS = Set.of("version", "all", "any", "exclude", "asOfDate");
    private static final Set<String> LEAF_FIELDS = Set.of(
            "type", "ids", "value", "values", "professionalFieldId", "professionalFieldIds",
            "attemptSelection", "assignmentIds", "fromDate", "toDate"
    );
    private static final Set<String> LEAF_TYPES = Set.of(
            "ALL_EMPLOYEES", "DEPARTMENT_IN", "POSITION_IN", "GROUP_IN", "USER_IN",
            "SENIORITY_MONTHS_LT", "SENIORITY_MONTHS_GTE", "FIELD_SCORE_LT", "EXAM_RESULT_IN"
    );
    private static final Set<String> COMPOSITE_FIELDS = Set.of("all", "any", "exclude");

    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final TrainingGroupRepository trainingGroupRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ExamAttemptFieldResultRepository fieldResultRepository;
    private final EvaluationAudienceRepository audienceRepository;

    @Transactional(readOnly = true)
    public EvaluationAudiencePreviewResponse preview(String ruleJson) {
        JsonNode root = parseAndValidate(ruleJson);
        List<User> eligible = activeUsers();
        Resolution resolution = resolveNode(root, eligible, root.path("asOfDate").isTextual()
                ? parseDate(root.path("asOfDate").asText()) : LocalDate.now(), 0);
        List<String> previewMissing = new ArrayList<>(resolution.missingData());
        if (root.toString().contains("SENIORITY_MONTHS_") && eligible.stream().anyMatch(user -> user.getEmploymentStartDate() == null)) {
            eligible.stream().filter(user -> user.getEmploymentStartDate() == null)
                    .map(user -> "Thiếu ngày vào làm: " + user.getEmployeeCode())
                    .forEach(previewMissing::add);
        }
        Set<Long> selected = new LinkedHashSet<>(resolution.ids());
        int excluded = Math.max(0, eligible.size() - selected.size());
        List<User> users = eligible.stream().filter(user -> selected.contains(user.getId())).toList();
        Map<String, Integer> breakdown = users.stream()
                .collect(Collectors.groupingBy(user -> user.getDepartment() == null ? "(Chưa gán khoa/phòng)" : user.getDepartment().getName(), LinkedHashMap::new, Collectors.summingInt(u -> 1)));
        List<EvaluationAudiencePreviewResponse.UserSample> sample = users.stream().limit(20)
                .map(user -> new EvaluationAudiencePreviewResponse.UserSample(
                        user.getId(), user.getEmployeeCode(), user.getName(),
                        user.getDepartment() == null ? null : user.getDepartment().getName(),
                        user.getPosition() == null ? null : user.getPosition().getName()))
                .toList();
        List<String> distinctMissing = previewMissing.stream().distinct().toList();
        boolean valid = !selected.isEmpty() && distinctMissing.isEmpty();
        return new EvaluationAudiencePreviewResponse(
                valid, users.size(), sample, breakdown, distinctMissing, excluded,
                resolution.explanation() == null ? "Đã lọc trên tài khoản ACTIVE và chưa xóa." : resolution.explanation(),
                fieldScoreMatches(root, selected));
    }

    @Transactional(readOnly = true)
    public List<EvaluationAudienceResponse> list() {
        return audienceRepository.findByStatusNotOrderByUpdatedAtDesc(EvaluationAudienceStatus.ARCHIVED)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public EvaluationAudienceResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public EvaluationAudienceResponse create(CreateEvaluationAudienceRequest request, String actor) {
        if (request == null) throw new BadRequestException("Dữ liệu đối tượng thi không hợp lệ");
        String name = request == null || request.name() == null ? null : request.name().trim();
        if (name == null || name.isBlank()) throw new BadRequestException("Vui lòng nhập tên đối tượng thi");
        String ruleJson = request.ruleJson();
        parseAndValidate(ruleJson);
        EvaluationAudience audience = audienceRepository.save(EvaluationAudience.builder()
                .name(name).ruleVersion(RULE_VERSION).ruleJson(ruleJson).version(1)
                .status(EvaluationAudienceStatus.DRAFT).createdBy(actor).build());
        return toResponse(audience);
    }

    @Transactional
    public EvaluationAudienceResponse update(Long id, CreateEvaluationAudienceRequest request, String actor) {
        if (request == null) throw new BadRequestException("Dữ liệu đối tượng thi không hợp lệ");
        EvaluationAudience current = find(id);
        if (current.getUsedAt() != null || current.getStatus() == EvaluationAudienceStatus.ACTIVE) {
            String name = request.name() == null ? current.getName() : request.name().trim();
            String rule = request.ruleJson() == null ? current.getRuleJson() : request.ruleJson();
            parseAndValidate(rule);
            EvaluationAudience next = audienceRepository.save(EvaluationAudience.builder()
                    .name(name).ruleVersion(RULE_VERSION).ruleJson(rule).version(current.getVersion() + 1)
                    .supersedes(current).status(EvaluationAudienceStatus.DRAFT).createdBy(actor).build());
            return toResponse(next);
        }
        if (request.name() != null && !request.name().isBlank()) current.setName(request.name().trim());
        if (request.ruleJson() != null) { parseAndValidate(request.ruleJson()); current.setRuleJson(request.ruleJson()); }
        return toResponse(audienceRepository.save(current));
    }

    @Transactional
    public EvaluationAudienceResponse activate(Long id) {
        EvaluationAudience audience = find(id);
        EvaluationAudiencePreviewResponse preview = preview(audience.getRuleJson());
        if (!preview.valid()) throw new BadRequestException("Tiêu chí đối tượng không hợp lệ");
        audience.setStatus(EvaluationAudienceStatus.ACTIVE);
        audience.setUsedAt(audience.getUsedAt() == null ? java.time.LocalDateTime.now() : audience.getUsedAt());
        return toResponse(audienceRepository.save(audience));
    }

    @Transactional
    public EvaluationAudienceResponse archive(Long id) {
        EvaluationAudience audience = find(id);
        audience.setStatus(EvaluationAudienceStatus.ARCHIVED);
        return toResponse(audienceRepository.save(audience));
    }

    @Transactional(readOnly = true)
    public ResolvedAudience resolveForAssignment(Long id) {
        EvaluationAudience audience = find(id);
        if (audience.getStatus() != EvaluationAudienceStatus.ACTIVE) {
            throw new BadRequestException("Chỉ được giao bài cho đối tượng thi đang hoạt động");
        }
        JsonNode root = parseAndValidate(audience.getRuleJson());
        EvaluationAudiencePreviewResponse preview = preview(audience.getRuleJson());
        if (!preview.valid()) {
            String details = preview.missingData().isEmpty()
                    ? "không có nhân viên phù hợp"
                    : String.join("; ", preview.missingData());
            throw new BadRequestException("Không thể giao bài: preview đối tượng chưa đạt (" + details + ")");
        }
        Resolution resolution = resolveNode(root, activeUsers(), root.path("asOfDate").isTextual()
                ? parseDate(root.path("asOfDate").asText()) : LocalDate.now(), 0);
        if (containsTenure(root) && activeUsers().stream().anyMatch(user -> user.getEmploymentStartDate() == null)) {
            throw new BadRequestException("Không thể giao bài: đối tượng có người thiếu ngày vào làm");
        }
        if (resolution.ids().isEmpty()) throw new BadRequestException("Không tìm thấy nhân viên phù hợp với đối tượng thi");
        return new ResolvedAudience(audience, resolution.ids(), audience.getRuleJson());
    }

    private EvaluationAudiencePreviewResponse toPreview(EvaluationAudience audience) { return preview(audience.getRuleJson()); }
    private EvaluationAudienceResponse toResponse(EvaluationAudience audience) {
        return new EvaluationAudienceResponse(audience.getId(), audience.getName(), audience.getRuleVersion(), audience.getRuleJson(), audience.getVersion(), audience.getStatus().name(), audience.getCreatedBy(), audience.getUsedAt(), audience.getCreatedAt(), audience.getUpdatedAt(), toPreview(audience));
    }
    private EvaluationAudience find(Long id) { return audienceRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đối tượng thi")); }
    private List<User> activeUsers() { return userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE); }
    private LocalDate parseDate(String value) { try { return LocalDate.parse(value); } catch (Exception ex) { throw new BadRequestException("asOfDate phải có định dạng YYYY-MM-DD"); } }

    private JsonNode parseAndValidate(String json) {
        if (json == null || json.isBlank()) throw new BadRequestException("ruleJson không được để trống");
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!root.isObject() || !root.path("version").isIntegralNumber()
                    || root.path("version").asInt(-1) != RULE_VERSION) {
                throw new BadRequestException("Rule phải là object version=1");
            }
            root.fieldNames().forEachRemaining(field -> { if (!TOP_LEVEL_FIELDS.contains(field)) throw new BadRequestException("Trường rule không được hỗ trợ: " + field); });
            if (root.has("asOfDate")) {
                if (!root.path("asOfDate").isTextual()) throw new BadRequestException("asOfDate phải có định dạng YYYY-MM-DD");
                parseDate(root.path("asOfDate").asText());
            }
            validateDepth(root, 0);
            return root;
        } catch (BadRequestException ex) { throw ex; }
        catch (Exception ex) { throw new BadRequestException("ruleJson không phải JSON hợp lệ"); }
    }
    private void validateDepth(JsonNode node, int depth) {
        if (depth > MAX_DEPTH) throw new BadRequestException("Rule vượt quá độ sâu cho phép");
        if (!node.isObject()) throw new BadRequestException("Mỗi nhánh rule phải là object");
        if (node.has("type")) {
            validateLeaf(node);
            return;
        }
        node.fieldNames().forEachRemaining(field -> {
            if (!COMPOSITE_FIELDS.contains(field) && !(depth == 0 && TOP_LEVEL_FIELDS.contains(field))) {
                throw new BadRequestException("Trường nhánh rule không được hỗ trợ: " + field);
            }
        });
        boolean hasAll = node.has("all");
        boolean hasAny = node.has("any");
        if (hasAll == hasAny) throw new BadRequestException("Mỗi nhánh rule phải có đúng một trong all hoặc any");
        validateChildren(node, hasAll ? "all" : "any", depth);
        if (node.has("exclude")) validateChildren(node, "exclude", depth);
    }

    private void validateChildren(JsonNode node, String field, int depth) {
        JsonNode children = node.path(field);
        if (!children.isArray() || children.isEmpty()) {
            throw new BadRequestException(field + " phải là mảng không rỗng");
        }
        // Count both the composite node and its child array in the depth budget;
        // this prevents deeply nested JSON from bypassing the whitelist through
        // arrays while keeping the limit independent of the JSON formatting.
        children.forEach(child -> validateDepth(child, depth + 2));
    }

    private void validateLeaf(JsonNode node) {
        node.fieldNames().forEachRemaining(field -> {
            if (!LEAF_FIELDS.contains(field)) throw new BadRequestException("Trường leaf không được hỗ trợ: " + field);
        });
        String type = node.path("type").asText();
        if (!LEAF_TYPES.contains(type)) throw new BadRequestException("Operator không được hỗ trợ: " + type);
        if (type.endsWith("_IN") && (!node.has("ids") || !node.path("ids").isArray())) {
            throw new BadRequestException("Operator " + type + " cần ids[]");
        }
        if (type.startsWith("SENIORITY") && (!node.path("value").isIntegralNumber() || node.path("value").asInt() < 0)) {
            throw new BadRequestException("Rule thâm niên cần value số không âm");
        }
        if (type.equals("FIELD_SCORE_LT") && (!node.path("value").isNumber()
                || (!node.has("professionalFieldId") && !node.has("professionalFieldIds")))) {
            throw new BadRequestException("FIELD_SCORE_LT cần value và professionalFieldId");
        }
        if (node.has("attemptSelection") && !Set.of("LATEST", "FIRST", "BEST")
                .contains(node.path("attemptSelection").asText().toUpperCase())) {
            throw new BadRequestException("attemptSelection chỉ nhận LATEST, FIRST hoặc BEST");
        }
        if (node.has("assignmentIds") && !node.path("assignmentIds").isArray()) {
            throw new BadRequestException("assignmentIds phải là mảng ID kỳ kiểm tra");
        }
        if (node.has("fromDate")) parseResultDate(node.path("fromDate").asText());
        if (node.has("toDate")) parseResultDate(node.path("toDate").asText());
        if (type.equals("EXAM_RESULT_IN") && !node.path("values").isArray()) {
            throw new BadRequestException("EXAM_RESULT_IN cần values[]");
        }
    }

    private Resolution resolveNode(JsonNode node, List<User> eligible, LocalDate asOf, int depth) {
        if (node.has("type")) return resolveLeaf(node, eligible, asOf);
        Resolution combined;
        if (node.has("all")) combined = combine(node.path("all"), eligible, asOf, true, depth);
        else if (node.has("any")) combined = combine(node.path("any"), eligible, asOf, false, depth);
        else combined = new Resolution(
                eligible.stream().map(User::getId).collect(Collectors.toCollection(LinkedHashSet::new)),
                List.of(), null, false
        );
        Set<Long> result = new LinkedHashSet<>(combined.ids());
        List<String> missing = new ArrayList<>(combined.missingData());
        String explanation = combined.explanation();
        boolean tenureDependent = combined.tenureDependent();
        if (node.has("exclude")) {
            Resolution excludedResolution = combine(node.path("exclude"), eligible, asOf, false, depth);
            Set<Long> excluded = excludedResolution.ids();
            missing.addAll(excludedResolution.missingData());
            int before = result.size(); result.removeAll(excluded);
            if (before > result.size()) {
                String excludedExplanation = "Đã loại " + (before - result.size()) + " người theo exclude";
                explanation = explanation == null ? excludedExplanation : explanation + "; " + excludedExplanation;
            }
            tenureDependent = tenureDependent || excludedResolution.tenureDependent();
        }
        return new Resolution(result, distinct(missing), explanation, tenureDependent);
    }
    private Resolution combine(JsonNode array, List<User> eligible, LocalDate asOf, boolean intersection, int depth) {
        Set<Long> result = null;
        List<String> missing = new ArrayList<>();
        String explanation = null;
        boolean tenureDependent = false;
        for (JsonNode child : array) {
            Resolution r = resolveNode(child, eligible, asOf, depth + 1);
            if (result == null) result = new LinkedHashSet<>(r.ids());
            else if (intersection) result.retainAll(r.ids()); else result.addAll(r.ids());
            missing.addAll(r.missingData());
            if (explanation == null && r.explanation() != null) explanation = r.explanation();
            tenureDependent = tenureDependent || r.tenureDependent();
        }
        return new Resolution(
                result == null ? new LinkedHashSet<>() : result,
                distinct(missing), explanation, tenureDependent
        );
    }
    private List<String> distinct(Collection<String> values) {
        return values.stream().filter(value -> value != null && !value.isBlank()).distinct().toList();
    }
    private Resolution resolveLeaf(JsonNode node, List<User> eligible, LocalDate asOf) {
        String type = node.path("type").asText();
        Set<Long> ids = eligible.stream().map(User::getId).collect(Collectors.toCollection(LinkedHashSet::new));
        List<String> missing = new ArrayList<>();
        boolean tenure = false;
        switch (type) {
            case "ALL_EMPLOYEES" -> { }
            case "USER_IN" -> ids.retainAll(longSet(node.path("ids")));
            case "DEPARTMENT_IN" -> ids.removeIf(id -> eligible.stream().filter(u -> u.getId().equals(id)).findFirst().map(u -> u.getDepartment() == null || !longSet(node.path("ids")).contains(u.getDepartment().getId())).orElse(true));
            case "POSITION_IN" -> ids.removeIf(id -> eligible.stream().filter(u -> u.getId().equals(id)).findFirst().map(u -> u.getPosition() == null || !longSet(node.path("ids")).contains(u.getPosition().getId())).orElse(true));
            case "GROUP_IN" -> {
                Set<Long> requested = longSet(node.path("ids"));
                List<TrainingGroup> groups = trainingGroupRepository.findByIdInAndActiveTrue(requested);
                if (groups.isEmpty()) { missing.add("Chưa có nhóm đào tạo hoặc thành viên nhóm"); ids.clear(); }
                else { Set<Long> members = groups.stream().flatMap(g -> g.getMembers().stream()).map(User::getId).collect(Collectors.toSet()); ids.retainAll(members); }
            }
            case "SENIORITY_MONTHS_LT", "SENIORITY_MONTHS_GTE" -> {
                tenure = true; int months = node.path("value").asInt();
                for (User user : eligible) {
                    if (user.getEmploymentStartDate() == null) { ids.remove(user.getId()); missing.add("Thiếu ngày vào làm: " + user.getEmployeeCode()); continue; }
                    int actual = Period.between(user.getEmploymentStartDate(), asOf).getYears() * 12 + Period.between(user.getEmploymentStartDate(), asOf).getMonths();
                    boolean match = type.endsWith("LT") ? actual < months : actual >= months;
                    if (!match) ids.remove(user.getId());
                }
            }
            case "FIELD_SCORE_LT" -> {
                List<ExamAttemptFieldResult> matches = selectedFieldResults(node).stream()
                        .filter(result -> result.getScore().compareTo(BigDecimal.valueOf(node.path("value").asDouble())) < 0)
                        .toList();
                if (matches.isEmpty()) {
                    ids.clear();
                    missing.add("Chưa có kết quả lĩnh vực phù hợp với tiêu chí đã chọn");
                } else {
                    ids.retainAll(matches.stream().map(result -> result.getAttempt().getUser().getId()).collect(Collectors.toSet()));
                }
            }
            case "EXAM_RESULT_IN" -> {
                List<ExamAttempt> attempts = examAttemptRepository.findAll().stream().filter(a -> a.getStatus() == ExamAttemptStatus.GRADED || a.getStatus() == ExamAttemptStatus.SUBMITTED).toList();
                if (attempts.isEmpty()) { ids.clear(); missing.add("Chưa có lượt thi đã chấm để đối chiếu kết quả"); }
                else {
                    Set<Long> matched = new HashSet<>();
                    for (ExamAttempt attempt : attempts) {
                        if (attempt.getScore() == null) continue;
                        if (type.equals("EXAM_RESULT_IN") && resultValues(node).stream().anyMatch(v -> (v.equals("PASSED") && Boolean.TRUE.equals(attempt.getPassed())) || (v.equals("FAILED") && Boolean.FALSE.equals(attempt.getPassed())))) matched.add(attempt.getUser().getId());
                    }
                    ids.retainAll(matched);
                }
            }
            default -> throw new BadRequestException("Operator không được hỗ trợ: " + type);
        }
        return new Resolution(ids, missing, missing.isEmpty() ? null : missing.get(0), tenure);
    }
    private Set<Long> longSet(JsonNode node) { Set<Long> set = new LinkedHashSet<>(); if (node != null && node.isArray()) node.forEach(n -> { if (n.isIntegralNumber()) set.add(n.longValue()); }); return set; }
    private Set<Long> fieldIds(JsonNode node) { return node.has("professionalFieldId") ? Set.of(node.path("professionalFieldId").longValue()) : longSet(node.path("professionalFieldIds")); }
    private Set<String> resultValues(JsonNode node) { Set<String> values = new HashSet<>(); node.path("values").forEach(v -> values.add(v.asText().toUpperCase())); return values; }
    private List<ExamAttemptFieldResult> selectedFieldResults(JsonNode node) {
        Set<Long> requestedFields = fieldIds(node);
        if (requestedFields.isEmpty()) return List.of();
        Set<Long> assignmentIds = longSet(node.path("assignmentIds"));
        LocalDateTime from = node.has("fromDate") ? parseResultDate(node.path("fromDate").asText()) : null;
        LocalDateTime to = node.has("toDate") ? endOfResultDate(node.path("toDate").asText()) : null;
        Comparator<ExamAttemptFieldResult> comparator = switch (node.path("attemptSelection").asText("LATEST").toUpperCase()) {
            case "FIRST" -> Comparator.comparing((ExamAttemptFieldResult result) -> resultDate(result.getAttempt()))
                    .thenComparing(result -> result.getAttempt().getId());
            case "BEST" -> Comparator.comparing(ExamAttemptFieldResult::getScore).reversed()
                    .thenComparing((ExamAttemptFieldResult result) -> resultDate(result.getAttempt()), Comparator.reverseOrder())
                    .thenComparing(result -> result.getAttempt().getId(), Comparator.reverseOrder());
            default -> Comparator.comparing((ExamAttemptFieldResult result) -> resultDate(result.getAttempt()), Comparator.reverseOrder())
                    .thenComparing(result -> result.getAttempt().getId(), Comparator.reverseOrder());
        };
        Map<String, ExamAttemptFieldResult> selected = new LinkedHashMap<>();
        fieldResultRepository.findGradedByProfessionalFieldIdIn(requestedFields).stream()
                .filter(result -> assignmentIds.isEmpty() || assignmentIds.contains(result.getAttempt().getAssignment().getId()))
                .filter(result -> from == null || !resultDate(result.getAttempt()).isBefore(from))
                .filter(result -> to == null || !resultDate(result.getAttempt()).isAfter(to))
                .sorted(comparator)
                .forEach(result -> selected.putIfAbsent(result.getAttempt().getUser().getId() + ":" + result.getProfessionalFieldId(), result));
        return List.copyOf(selected.values());
    }

    private List<EvaluationAudiencePreviewResponse.FieldScoreMatch> fieldScoreMatches(JsonNode root, Set<Long> selectedUsers) {
        List<EvaluationAudiencePreviewResponse.FieldScoreMatch> matches = new ArrayList<>();
        fieldScoreLeaves(root).forEach(node -> selectedFieldResults(node).stream()
                .filter(result -> selectedUsers.contains(result.getAttempt().getUser().getId()))
                .filter(result -> result.getScore().compareTo(BigDecimal.valueOf(node.path("value").asDouble())) < 0)
                .forEach(result -> matches.add(new EvaluationAudiencePreviewResponse.FieldScoreMatch(
                        result.getAttempt().getUser().getId(), result.getAttempt().getUser().getEmployeeCode(), result.getAttempt().getUser().getName(),
                        result.getAttempt().getId(), result.getAttempt().getSubmittedAt(), result.getProfessionalFieldId(), result.getProfessionalFieldCode(),
                        result.getProfessionalFieldName(), result.getScore(), BigDecimal.valueOf(node.path("value").asDouble()),
                        "Điểm " + result.getProfessionalFieldName() + " thấp hơn ngưỡng " + node.path("value").asText()
                ))));
        return matches.stream().distinct().limit(100).toList();
    }

    private List<JsonNode> fieldScoreLeaves(JsonNode node) {
        List<JsonNode> leaves = new ArrayList<>();
        collectFieldScoreLeaves(node, leaves);
        return leaves;
    }

    private void collectFieldScoreLeaves(JsonNode node, List<JsonNode> leaves) {
        if (node == null) return;
        if (node.isObject()) {
            if ("FIELD_SCORE_LT".equals(node.path("type").asText())) leaves.add(node);
            node.elements().forEachRemaining(child -> collectFieldScoreLeaves(child, leaves));
        } else if (node.isArray()) node.forEach(child -> collectFieldScoreLeaves(child, leaves));
    }

    private LocalDateTime parseResultDate(String value) {
        try { return LocalDateTime.parse(value); }
        catch (Exception ignored) {
            try { return LocalDate.parse(value).atStartOfDay(); }
            catch (Exception ex) { throw new BadRequestException("fromDate/toDate phải có định dạng YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm:ss"); }
        }
    }

    private LocalDateTime endOfResultDate(String value) {
        LocalDateTime parsed = parseResultDate(value);
        return value != null && value.length() == 10 ? parsed.toLocalDate().atTime(23, 59, 59) : parsed;
    }

    private LocalDateTime resultDate(ExamAttempt attempt) {
        return attempt.getSubmittedAt() == null ? attempt.getStartedAt() : attempt.getSubmittedAt();
    }
    private boolean containsTenure(JsonNode node) { return node.isObject() && ((node.has("type") && node.path("type").asText().startsWith("SENIORITY_")) || ((node.has("all") && node.path("all").toString().contains("SENIORITY_")) || (node.has("any") && node.path("any").toString().contains("SENIORITY_")))); }
    public record ResolvedAudience(EvaluationAudience audience, Set<Long> userIds, String ruleJson) { }
    private record Resolution(Set<Long> ids, List<String> missingData, String explanation, boolean tenureDependent) { }
}

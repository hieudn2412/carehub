package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record DocumentSectionResponse(
        Long id,
        Long parentId,
        String title,
        Integer level,
        Integer orderIndex,
        Integer pageStart,
        Integer pageEnd,
        String path,
        Double confidence
) {
}

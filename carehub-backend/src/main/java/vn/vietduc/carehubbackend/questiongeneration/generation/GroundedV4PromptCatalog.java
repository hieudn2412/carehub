package vn.vietduc.carehubbackend.questiongeneration.generation;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
public class GroundedV4PromptCatalog {
    public static final String VERSION = "grounded-v4.1.0";
    private static final String ROOT = "ai/prompts/grounded-v4/";

    private final String knowledgePrompt;
    private final String questionPrompt;
    private final String criticPrompt;
    private final String manifestHash;

    public GroundedV4PromptCatalog() {
        this.knowledgePrompt = read("knowledge.txt");
        this.questionPrompt = read("question.txt");
        this.criticPrompt = read("critic.txt");
        this.manifestHash = sha256(
                VERSION + "\n" + knowledgePrompt + "\n" + questionPrompt + "\n" + criticPrompt
        );
    }

    public String knowledgePrompt() {
        return knowledgePrompt;
    }

    public String questionPrompt() {
        return questionPrompt;
    }

    public String criticPrompt() {
        return criticPrompt;
    }

    public String version() {
        return VERSION;
    }

    public String manifestHash() {
        return manifestHash;
    }

    public String versionWithHash() {
        return VERSION + ":" + manifestHash.substring(0, 12);
    }

    private String read(String filename) {
        try {
            return new ClassPathResource(ROOT + filename)
                    .getContentAsString(StandardCharsets.UTF_8)
                    .trim();
        } catch (IOException ex) {
            throw new IllegalStateException("Không đọc được prompt Grounded v4: " + filename, ex);
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }
}

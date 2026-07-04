package vn.vietduc.carehubbackend.questiongeneration.repository.projection;

public interface CountByKeyProjection {
    String getKey();
    Long getCount();
}

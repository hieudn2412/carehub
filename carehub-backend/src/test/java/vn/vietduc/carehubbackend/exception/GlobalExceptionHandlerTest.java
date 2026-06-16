package vn.vietduc.carehubbackend.exception;

import jakarta.persistence.OptimisticLockException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void optimisticLockingReturnsConflict() {
        var request = new MockHttpServletRequest();
        var response = handler.handleOptimisticLock(new OptimisticLockException("Version mismatch"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errorCode()).isEqualTo("SYS_409");
        assertThat(response.getBody().message()).isEqualTo("Version mismatch");
        assertThat(response.getBody().correlationId()).isNotBlank();
    }
}

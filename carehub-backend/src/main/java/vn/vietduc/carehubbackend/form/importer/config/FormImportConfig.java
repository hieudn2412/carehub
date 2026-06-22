package vn.vietduc.carehubbackend.form.importer.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;

@Configuration
@EnableConfigurationProperties(FormImportProperties.class)
public class FormImportConfig {
    @Bean
    RestClient googleFormRestClient(FormImportProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.googlePublic().connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(properties.googlePublic().readTimeout());
        return RestClient.builder().requestFactory(factory).build();
    }
}

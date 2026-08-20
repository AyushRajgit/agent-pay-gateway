package com.razorpay.buildathon.agent_pay_gateway.config;

import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import com.razorpay.buildathon.agent_pay_gateway.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.math.BigDecimal;
import java.util.List;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(ProductRepository productRepository) {
        return args -> {
            if (productRepository.count() == 0) {
                productRepository.saveAll(List.of(
                        Product.builder()
                                .sku("LP-101")
                                .name("Pro Developer Laptop 16-inch")
                                .category("Laptops")
                                .price(new BigDecimal("45000.00"))
                                .stock(10)
                                .agentMetadata("{\"upsell_target\": \"ACC-09\"}")
                                .build(),
                        Product.builder()
                                .sku("ACC-09")
                                .name("Ergonomic Wireless Mouse")
                                .category("Accessories")
                                .price(new BigDecimal("1200.00"))
                                .stock(50)
                                .agentMetadata("{\"discountable\": true}")
                                .build()
                ));
                System.out.println(">>> Sample Agent Catalog Data Seeded! <<<");
            }
        };
    }
}
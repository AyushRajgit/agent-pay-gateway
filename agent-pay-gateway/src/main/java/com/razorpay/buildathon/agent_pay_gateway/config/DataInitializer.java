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
                                .build(),
                        Product.builder()
                                .sku("PH-202")
                                .name("Smartphone Pro 5G")
                                .category("Smartphones")
                                .price(new BigDecimal("35000.00"))
                                .stock(25)
                                .agentMetadata("{\"bundle_eligible\": true}")
                                .build(),
                        Product.builder()
                                .sku("MN-404")
                                .name("UltraWide 34-inch Monitor")
                                .category("Monitors")
                                .price(new BigDecimal("32000.00"))
                                .stock(15)
                                .agentMetadata("{\"upsell_target\": \"KB-606\"}")
                                .build(),
                        Product.builder()
                                .sku("KB-606")
                                .name("Mechanical Coding Keyboard")
                                .category("Accessories")
                                .price(new BigDecimal("4500.00"))
                                .stock(30)
                                .agentMetadata("{\"discountable\": false}")
                                .build()
                ));
                System.out.println(">>> Sample Agent Catalog Data Seeded! <<<");
            }
        };
    }
}
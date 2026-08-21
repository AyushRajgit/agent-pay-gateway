package com.razorpay.buildathon.agent_pay_gateway.repository;

import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    // By PESSIMISTIC_WRITE lock, I am forcing the database to lock this specific row
    // until the current transaction is finished.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Product> findBySku(String sku);
}
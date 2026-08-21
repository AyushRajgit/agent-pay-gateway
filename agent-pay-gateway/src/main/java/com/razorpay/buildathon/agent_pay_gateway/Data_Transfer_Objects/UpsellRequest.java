package com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class UpsellRequest {
    private String sku;
    private BigDecimal agentBudgetMandate;
}
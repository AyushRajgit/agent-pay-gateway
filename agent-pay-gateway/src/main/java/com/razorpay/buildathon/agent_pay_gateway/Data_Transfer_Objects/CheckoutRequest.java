package com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CheckoutRequest {
    private String agentId;
    private List<String> skuList;
    private BigDecimal agentBudgetMandate;
}

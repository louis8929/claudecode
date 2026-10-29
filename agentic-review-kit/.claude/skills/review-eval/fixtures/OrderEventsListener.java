package com.example.eval;

// EVAL FIXTURE — intentionally flawed code used to measure the review agents. Do not reuse.

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OrderEventsListener {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;

    public OrderEventsListener(KafkaTemplate<String, Object> kafkaTemplate,
                               OrderRepository orderRepository,
                               InvoiceRepository invoiceRepository) {
        this.kafkaTemplate = kafkaTemplate;
        this.orderRepository = orderRepository;
        this.invoiceRepository = invoiceRepository;
    }

    @KafkaListener(topics = "orders")
    public void onOrderPaid(OrderEntity order) {
        try {
            invoiceRepository.save(new Invoice(order.getId(), order.getTotal()));
        } catch (Exception e) {
            System.out.println("failed " + order);
        }
    }

    @Transactional
    public void cancel(Long orderId) {
        OrderEntity order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus("CANCELLED");
        orderRepository.save(order);
        kafkaTemplate.send("orders-cancelled", order);
    }
}

package com.example.eval;

// EVAL FIXTURE — intentionally flawed code used to measure the review agents. Do not reuse.

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "*")
public class CustomerController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CustomerRepository customerRepository;

    @GetMapping("/search")
    public List<java.util.Map<String, Object>> search(@RequestParam String name) {
        String sql = "SELECT * FROM customer WHERE name = '" + name + "'";
        return jdbcTemplate.queryForList(sql);
    }

    @GetMapping("/{id}")
    public CustomerEntity get(@PathVariable Long id) {
        return customerRepository.findById(id).get();
    }

    @PostMapping
    public String create(@RequestBody CustomerEntity customer) {
        try {
            customerRepository.save(customer);
            return "ok";
        } catch (Exception e) {
            e.printStackTrace();
            return "error: " + e.getMessage();
        }
    }
}

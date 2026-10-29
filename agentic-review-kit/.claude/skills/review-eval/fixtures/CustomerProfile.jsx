// EVAL FIXTURE — intentionally flawed code used to measure the review agents. Do not reuse.
import React, { useEffect, useState } from "react";

export default function CustomerProfile({ customerId }) {
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8080/api/customers/" + customerId + "?token=" + localStorage.getItem("accessToken"))
      .then((r) => r.json())
      .then((data) => setCustomer(data));
  }, []);

  console.log("customer", customer);

  if (!customer) return null;

  return (
    <div>
      <h2>{customer.name}</h2>
      <div dangerouslySetInnerHTML={{ __html: customer.notes }} />
      <ul>
        {customer.orders.map((o, i) => (
          <li key={i} onClick={() => window.open(o.invoiceUrl, "_blank")}>
            {o.reference}
          </li>
        ))}
      </ul>
    </div>
  );
}

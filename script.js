let loans = JSON.parse(localStorage.getItem("loans")) || [];

document.getElementById("loanForm").addEventListener("submit", function (e) {
  e.preventDefault();

  let name = document.getElementById("loanName").value.trim();
  let principal = parseFloat(document.getElementById("loanPrincipal").value);
  let tenure = parseInt(document.getElementById("loanTenure").value);
  let emi = parseFloat(document.getElementById("loanEMI").value);

  if (!name || isNaN(principal) || isNaN(tenure) || isNaN(emi)) {
    return alert("Please fill all fields correctly");
  }

  let loan = {
    name,
    principal,
    tenure,
    emi,
    outstanding: principal,
    paidMonths: 0,
    transactions: [],
    editing: false
  };

  loans.push(loan);
  saveLoans();
  this.reset();
  renderLoans();
});

// Save to local storage
function saveLoans() {
  localStorage.setItem("loans", JSON.stringify(loans));
}

// Pay EMI
function payEMI(index, customDate) {
  let loan = loans[index];
  if (loan.outstanding <= 0) return alert("Loan already closed!");

  loan.paidMonths += 1;
  loan.outstanding -= loan.emi;
  if (loan.outstanding < 0) loan.outstanding = 0;

  loan.transactions.push({
    type: "EMI",
    amount: loan.emi,
    date: customDate || new Date().toLocaleDateString()
  });

  saveLoans();
  renderLoans();
}

// Extra payment
function makeExtraPayment(index) {
  let loan = loans[index];
  let extraInput = document.querySelectorAll(".extraInput")[index];
  let amount = parseFloat(extraInput.value);

  if (!amount || amount <= 0) return alert("Enter valid amount");
  if (loan.outstanding <= 0) return alert("Loan already closed!");

  loan.outstanding -= amount;
  if (loan.outstanding < 0) loan.outstanding = 0;

  loan.transactions.push({
    type: "Extra Payment",
    amount: amount,
    date: new Date().toLocaleDateString()
  });

  extraInput.value = "";
  saveLoans();
  renderLoans();
}

// Delete loan
function deleteLoan(index) {
  if (!confirm("Are you sure you want to delete this loan?")) return;
  loans.splice(index, 1);
  saveLoans();
  renderLoans();
}

// Edit loan toggle
function toggleEditLoan(index) {
  loans[index].editing = !loans[index].editing;
  renderLoans();
}

// Save edited loan
function saveEditLoan(index) {
  let name = document.getElementById(`editName${index}`).value.trim();
  let principal = parseFloat(document.getElementById(`editPrincipal${index}`).value);
  let tenure = parseInt(document.getElementById(`editTenure${index}`).value);
  let emi = parseFloat(document.getElementById(`editEMI${index}`).value);

  if (!name || isNaN(principal) || isNaN(tenure) || isNaN(emi)) {
    return alert("Please fill all fields correctly");
  }

  let loan = loans[index];
  loan.name = name;
  loan.principal = principal;
  loan.tenure = tenure;
  loan.emi = emi;

  // Recalculate outstanding based on transactions
  let paidExtra = loan.transactions
    .filter(t => t.type === "Extra Payment")
    .reduce((sum, t) => sum + t.amount, 0);
  let paidEmis = loan.transactions.filter(t => t.type === "EMI").length;

  loan.outstanding = principal - (paidEmis * emi) - paidExtra;
  if (loan.outstanding < 0) loan.outstanding = 0;

  loan.editing = false;
  saveLoans();
  renderLoans();
}

// Calculate closure date
function calculateClosureDate(loan) {
  let remainingMonths = Math.ceil(loan.outstanding / loan.emi);

  if (remainingMonths <= 0) return "Closed";

  let lastDate = loan.transactions.length > 0
    ? new Date(loan.transactions[loan.transactions.length - 1].date)
    : new Date();

  lastDate.setMonth(lastDate.getMonth() + remainingMonths);

  return lastDate.toLocaleDateString();
}

// Render summary
function renderSummary() {
  let totalLoans = loans.length;
  let totalOutstanding = loans.reduce((sum, loan) => sum + loan.outstanding, 0);
  let totalMonthlyEMI = loans.reduce((sum, loan) => sum + loan.emi, 0);

  let closureDates = loans.map(calculateClosureDate).filter(d => d !== "Closed");
  let overallClosure = closureDates.length > 0
    ? closureDates.sort((a, b) => new Date(b) - new Date(a))[0]
    : "All Loans Closed";

  document.getElementById("totalLoans").textContent = totalLoans;
  document.getElementById("totalOutstanding").textContent = `₹${totalOutstanding.toFixed(2)}`;
  document.getElementById("totalMonthlyEMI").textContent = `₹${totalMonthlyEMI.toFixed(2)}`;
  document.getElementById("closureDate").textContent = overallClosure;
}

// Render loans
function renderLoans() {
  let container = document.getElementById("loanList");
  container.innerHTML = "";

  loans.forEach((loan, index) => {
    let loanCard = document.createElement("div");
    loanCard.className = "loan-card";

    if (loan.editing) {
      loanCard.innerHTML = `
        <h3>Edit Loan</h3>
        <input id="editName${index}" type="text" value="${loan.name}" />
        <input id="editPrincipal${index}" type="number" value="${loan.principal}" />
        <input id="editTenure${index}" type="number" value="${loan.tenure}" />
        <input id="editEMI${index}" type="number" value="${loan.emi}" />
        <div class="loan-actions">
          <button onclick="saveEditLoan(${index})">Save</button>
          <button class="delete" onclick="toggleEditLoan(${index})">Cancel</button>
        </div>
      `;
    } else {
      loanCard.innerHTML = `
        <h3>${loan.name}</h3>
        <p>Principal: ₹${loan.principal}</p>
        <p>Outstanding: ₹${loan.outstanding.toFixed(2)}</p>
        <p>Tenure: ${loan.tenure} months</p>
        <p>EMI: ₹${loan.emi}</p>
        <p>Expected Closure: ${calculateClosureDate(loan)}</p>
        <div class="loan-actions">
          <button onclick="payEMI(${index})">Pay EMI</button>
          <button onclick="toggleEditLoan(${index})" class="edit">Edit</button>
          <button onclick="deleteLoan(${index})" class="delete">Delete</button>
        </div>
        <div class="extra-payment">
          <input type="number" placeholder="Extra Payment" class="extraInput" />
          <button onclick="makeExtraPayment(${index})">Pay Extra</button>
        </div>
        <div class="transactions">
          <h4>Transactions</h4>
          <table>
            <tr><th>Type</th><th>Amount</th><th>Date</th></tr>
            ${loan.transactions.map(t => `
              <tr>
                <td>${t.type}</td>
                <td>₹${t.amount}</td>
                <td>${t.date}</td>
              </tr>
            `).join("")}
          </table>
        </div>
      `;
    }

    container.appendChild(loanCard);
  });

  renderSummary();
}

// Initial render
renderLoans();

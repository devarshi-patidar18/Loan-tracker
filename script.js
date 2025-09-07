// Loan tracker - principal-only outstanding calculation + custom date + transactions table + delete support
let loans = JSON.parse(localStorage.getItem("loans")) || [];

let balanceChart = null;
let pieChart = null;

function saveLoans() {
  localStorage.setItem("loans", JSON.stringify(loans));
}

function calculateEMI(amount, rate, tenure) {
  let monthlyRate = rate / 12 / 100;
  if (monthlyRate === 0) return amount / tenure;
  return (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
         (Math.pow(1 + monthlyRate, tenure) - 1);
}

function getSelectedDate(index) {
  let input = document.getElementById(`date-${index}`);
  // If user picks a date input (YYYY-MM-DD) use that; otherwise store ISO now
  return input && input.value ? input.value : new Date().toISOString();
}

function formatDisplayDate(dateStr) {
  try { return new Date(dateStr).toLocaleDateString(); } catch(e) { return dateStr; }
}

function sortTransactions(loan){
  if(!loan.transactions) loan.transactions = [];
  loan.transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
}

/*
  Compute outstanding principal by simulating recorded transactions in chronological order.
  - Regular EMI: interest = principal * r; principal component = EMI - interest
  - Extra EMI: treated as (one EMI) + extra principal (amount - EMI) when amount >= EMI
  - Other amounts: treated as direct principal reduction
*/
function computeOutstandingPrincipal(loan) {
  let principal = loan.amount; // original principal
  const r = loan.rate / 12 / 100;
  if (!loan.transactions) loan.transactions = [];
  sortTransactions(loan);

  for (const t of loan.transactions) {
    if (principal <= 0) { principal = 0; break; }

    if (t.type === "Regular EMI") {
      if (r > 0) {
        let interest = principal * r;
        let principalComponent = t.amount - interest;
        if (principalComponent < 0) principalComponent = 0;
        principal = Math.max(0, principal - principalComponent);
      } else {
        principal = Math.max(0, principal - t.amount);
      }
    } else if (t.type === "Extra EMI") {
      if (r > 0) {
        // First apply one EMI's principal component
        let interest = principal * r;
        let principalComponent = loan.emi - interest;
        if (principalComponent < 0) principalComponent = 0;
        principal = Math.max(0, principal - principalComponent);

        // Remaining part of the extra payment goes straight to principal
        let extra = t.amount - loan.emi;
        if (extra > 0) principal = Math.max(0, principal - extra);
      } else {
        // zero interest => entire extra amount reduces principal
        principal = Math.max(0, principal - t.amount);
      }
    } else {
      // custom / other payment - treat as principal reduction
      principal = Math.max(0, principal - t.amount);
    }
  }

  return parseFloat(principal.toFixed(2));
}

/* Given principal, EMI and rate, compute remaining months (ceiling).
   Return Infinity if EMI <= principal*rate (can't amortize), or 0 if principal <= 0.
*/
function calculateRemainingEmisForPrincipal(principal, loan) {
  if (principal <= 0) return 0;
  const r = loan.rate / 12 / 100;
  const E = loan.emi;
  if (r === 0) return Math.ceil(principal / E);
  if (E <= principal * r) return Infinity;
  const n = Math.log(E / (E - principal * r)) / Math.log(1 + r);
  return Math.ceil(n);
}

function calculateRemainingEmis(loan) {
  const principal = computeOutstandingPrincipal(loan);
  return calculateRemainingEmisForPrincipal(principal, loan);
}

function calculateClosureDate(loan) {
  let remaining = calculateRemainingEmis(loan);
  if (remaining === 0) return "Closed";
  if (remaining === Infinity) return "N/A";

  let base = (loan.transactions && loan.transactions.length > 0)
      ? new Date(loan.transactions[loan.transactions.length - 1].date)
      : new Date();

  let closure = new Date(base);
  closure.setMonth(closure.getMonth() + remaining);
  return closure.toLocaleDateString();
}

function getTransactionsWithRemaining(loan) {
  // simulate transactions sequentially and compute remaining after each
  let rows = [];
  let principal = loan.amount;
  const r = loan.rate / 12 / 100;

  const txs = (loan.transactions || []).slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  for (const t of txs) {
    if (principal <= 0) principal = 0;

    if (t.type === "Regular EMI") {
      if (r > 0) {
        let interest = principal * r;
        let principalComponent = t.amount - interest;
        if (principalComponent < 0) principalComponent = 0;
        principal = Math.max(0, principal - principalComponent);
      } else {
        principal = Math.max(0, principal - t.amount);
      }
    } else if (t.type === "Extra EMI") {
      if (r > 0) {
        let interest = principal * r;
        let principalComponent = loan.emi - interest;
        if (principalComponent < 0) principalComponent = 0;
        principal = Math.max(0, principal - principalComponent);

        let extra = t.amount - loan.emi;
        if (extra > 0) principal = Math.max(0, principal - extra);
      } else {
        principal = Math.max(0, principal - t.amount);
      }
    } else {
      principal = Math.max(0, principal - t.amount);
    }

    let remaining = calculateRemainingEmisForPrincipal(principal, loan);
    rows.push({
      date: t.date,
      type: t.type,
      amount: parseFloat(t.amount).toFixed(2),
      remaining: remaining === Infinity ? "N/A" : remaining
    });
  }

  return rows;
}

function renderSummary() {
  let totalLoans = loans.length;
  let totalOutstanding = loans.reduce((sum, loan) => sum + computeOutstandingPrincipal(loan), 0);
  let totalMonthlyEMI = loans.reduce((sum, loan) => sum + (loan.emi || 0), 0);

  let closureDates = loans
    .map(l => calculateClosureDate(l))
    .filter(d => d !== "Closed" && d !== "N/A");
  let overallClosure = closureDates.length > 0
    ? closureDates.sort((a, b) => new Date(b) - new Date(a))[0]
    : "All Loans Closed";

  document.getElementById("totalLoans").textContent = `Total Loans: ${totalLoans}`;
  document.getElementById("totalOutstanding").textContent = `Total Outstanding Principal: ₹${totalOutstanding.toFixed(2)}`;
  document.getElementById("totalMonthlyEMI").textContent = `Total Monthly EMI: ₹${totalMonthlyEMI.toFixed(2)}`;
  document.getElementById("closureDate").textContent = `Expected Loan Closure: ${overallClosure}`;
}

function renderCharts() {
  const ctx1 = document.getElementById("balanceChart").getContext("2d");
  const ctx2 = document.getElementById("pieChart").getContext("2d");

  // destroy previous charts to avoid duplicates
  if (balanceChart) balanceChart.destroy();
  if (pieChart) pieChart.destroy();

  const labels = loans.map(l => l.name);
  const outstanding = loans.map(l => computeOutstandingPrincipal(l));
  const paidPrincipal = loans.map(l => parseFloat((l.amount - computeOutstandingPrincipal(l)).toFixed(2)));

  balanceChart = new Chart(ctx1, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Outstanding Principal", data: outstanding },
        { label: "Paid Principal", data: paidPrincipal }
      ]
    }
  });

  pieChart = new Chart(ctx2, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: outstanding,
      }]
    }
  });
}

function renderLoans() {
  const loanList = document.getElementById("loanList");
  loanList.innerHTML = "";

  loans.forEach((loan, index) => {
    if (!loan.transactions) loan.transactions = [];
    sortTransactions(loan);

    // keep paidMonths consistent with recorded REGULAR EMI transactions
    loan.paidMonths = loan.transactions.filter(t => t.type === "Regular EMI").length;

    const outstanding = computeOutstandingPrincipal(loan);
    const remainingEmis = calculateRemainingEmis(loan);
    const progressPct = ((loan.amount - outstanding) / loan.amount) * 100;

    let card = document.createElement("div");
    card.className = "loan-card";

    // transactions rows (with remaining after each tx)
    const txRows = getTransactionsWithRemaining(loan).map((t, txIdx) => {
      return `
      <tr>
        <td>${formatDisplayDate(t.date)}</td>
        <td>${t.type}</td>
        <td>₹${t.amount}</td>
        <td>${t.remaining}</td>
        <td><button class="small delete" onclick="deleteTransaction(${index}, ${txIdx})">Delete</button></td>
      </tr>`;
    }).join("");

    card.innerHTML = `
      <h3>${loan.name}</h3>
      <p>Original Principal: ₹${loan.amount}</p>
      <p>Interest Rate: ${loan.rate}%</p>
      <p>Original Tenure: ${loan.tenure} months</p>
      <p>Monthly EMI: ₹${loan.emi.toFixed(2)}</p>
      <p><strong>Outstanding Principal:</strong> ₹${outstanding.toFixed(2)}</p>
      <p><strong>Remaining EMIs:</strong> ${remainingEmis === Infinity ? 'N/A' : remainingEmis}</p>

      <div class="progress"><div class="progress-bar" style="width:${progressPct}%"></div></div>

      <label>Select Payment Date:</label>
      <input type="date" id="date-${index}" />
      <div class="loan-actions">
        <button class="pay" onclick="payEMI(${index})">Pay EMI</button>
        <button class="extra" onclick="payExtraEMI(${index})">Pay Extra EMI</button>
        <button class="delete" onclick="deleteLoan(${index})">Delete Loan</button>
      </div>

      <h4>Transactions</h4>
      <table>
        <tr>
          <th>Date</th><th>Type</th><th>Amount</th><th>Remaining EMIs</th><th>Action</th>
        </tr>
        ${txRows || '<tr><td colspan="5" style="text-align:center;color:#888">No transactions yet</td></tr>'}
      </table>
    `;

    loanList.appendChild(card);
  });

  renderCharts();
  renderSummary();
}

function payEMI(index) {
  const loan = loans[index];
  const date = getSelectedDate(index);

  // record one regular EMI (amount = loan.emi)
  loan.transactions.push({
    date,
    type: "Regular EMI",
    amount: parseFloat(loan.emi.toFixed(2))
  });

  sortTransactions(loan);
  // recalc paidMonths
  loan.paidMonths = loan.transactions.filter(t => t.type === "Regular EMI").length;

  saveLoans();
  renderLoans();
}

function payExtraEMI(index) {
  const loan = loans[index];
  const date = getSelectedDate(index);

  // here we treat extra as double EMI (existing behavior). You can change this logic to accept custom extra amount.
  const extraAmount = parseFloat((loan.emi * 2).toFixed(2));

  loan.transactions.push({
    date,
    type: "Extra EMI",
    amount: extraAmount
  });

  sortTransactions(loan);
  loan.paidMonths = loan.transactions.filter(t => t.type === "Regular EMI").length;

  saveLoans();
  renderLoans();
}

function deleteLoan(index) {
  if (!confirm("Are you sure you want to delete this loan? This will remove all transactions.")) return;
  loans.splice(index, 1);
  saveLoans();
  renderLoans();
}

function deleteTransaction(loanIndex, txIndex) {
  if (!confirm("Delete this transaction?")) return;
  // transactions array is kept sorted so txIndex corresponds to sorted order
  loans[loanIndex].transactions.splice(txIndex, 1);
  loans[loanIndex].paidMonths = loans[loanIndex].transactions.filter(t => t.type === "Regular EMI").length;
  saveLoans();
  renderLoans();
}

/* Form to add new loan */
document.getElementById("loanForm").addEventListener("submit", function(e) {
  e.preventDefault();
  let name = document.getElementById("loanName").value.trim();
  let amount = parseFloat(document.getElementById("loanAmount").value);
  let rate = parseFloat(document.getElementById("loanRate").value);
  let tenure = parseInt(document.getElementById("loanTenure").value);

  if (!name || !amount || !rate || !tenure) {
    alert("Please fill all fields correctly.");
    return;
  }

  let emi = calculateEMI(amount, rate, tenure);

  const newLoan = {
    name,
    amount: parseFloat(amount.toFixed(2)),
    rate: parseFloat(rate.toFixed(2)),
    tenure,
    emi: parseFloat(emi.toFixed(2)),
    transactions: [],
    paidMonths: 0
  };

  loans.push(newLoan);
  saveLoans();
  renderLoans();
  this.reset();
});

/* initial render */
renderLoans();

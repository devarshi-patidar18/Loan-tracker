let loans = JSON.parse(localStorage.getItem("loans")) || [];

function saveLoans() {
  localStorage.setItem("loans", JSON.stringify(loans));
}

function calculateEMI(amount, rate, tenure) {
  let monthlyRate = rate / 12 / 100;
  return (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
         (Math.pow(1 + monthlyRate, tenure) - 1);
}

function renderLoans() {
  const loanList = document.getElementById("loanList");
  loanList.innerHTML = "";

  loans.forEach((loan, index) => {
    let card = document.createElement("div");
    card.className = "loan-card";

    let remainingEMIs = loan.tenure - loan.paidMonths;
    let outstanding = (loan.emi * remainingEMIs).toFixed(2);
    let progress = (loan.paidMonths / loan.tenure) * 100;

    // Loan card UI
    card.innerHTML = `
      <h3>${loan.name}</h3>
      <p>Amount: ₹${loan.amount}</p>
      <p>Rate: ${loan.rate}%</p>
      <p>Tenure: ${loan.tenure} months</p>
      <p>EMI: ₹${loan.emi.toFixed(2)}</p>
      <p>Outstanding: ₹${outstanding}</p>
      <p>Remaining EMIs: ${remainingEMIs}</p>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
      
      <label>Select Payment Date:</label>
      <input type="date" id="date-${index}" />
      <br>
      <button onclick="payEMI(${index})">Pay EMI</button>
      <button onclick="payExtraEMI(${index})">Pay Extra EMI</button>
      <button onclick="deleteLoan(${index})" style="background:#e84118;color:white;">Delete Loan</button>
      
      <h4>Transactions</h4>
      <table border="1" cellpadding="5" cellspacing="0" style="width:100%;margin-top:10px;">
        <tr>
          <th>Date</th>
          
          <th>Amount</th>
          <th>Remaining EMIs</th>
          <th>Action</th>
        </tr>
        ${loan.transactions.map(t => `
          <tr>
            <td>${t.date}</td>
          
            <td>₹${t.amount}</td>
            <td>${t.remaining}</td>
            <td><button onclick="deleteTransaction(${index})" style="background:#e84118;color:white;">Delete</button>
            </td>
          </tr>
        `).join("")}
      </table>
    `;

    loanList.appendChild(card);
  });

  renderCharts();
renderSummary();

  renderCharts();
}

function deleteTransaction(index){
  alert("delete transaction");
}

function getSelectedDate(index) {
  let input = document.getElementById(`date-${index}`);
  return input && input.value ? input.value : new Date().toLocaleDateString();
}

function payEMI(index) {
  
  if (confirm("Pay EMI ?") && loans[index].paidMonths < loans[index].tenure) {
    loans[index].paidMonths += 1;
    let remaining = loans[index].tenure - loans[index].paidMonths;
    loans[index].transactions.push({
      date: getSelectedDate(index),
      type: "Regular EMI",
      amount: loans[index].emi.toFixed(2),
      remaining
    });
    saveLoans();
    renderLoans();
  }
}

function payExtraEMI(index) {
  if (loans[index].paidMonths < loans[index].tenure) {
    loans[index].paidMonths += 2;
    if (loans[index].paidMonths > loans[index].tenure) loans[index].paidMonths = loans[index].tenure;
    let remaining = loans[index].tenure - loans[index].paidMonths;
    loans[index].transactions.push({
      date: getSelectedDate(index),
      type: "Extra EMI",
      amount: (2 * loans[index].emi).toFixed(2),
      remaining
    });
    saveLoans();
    renderLoans();
  }
}

function deleteLoan(index) {
  if (confirm("Are you sure you want to delete this loan?")) {
    loans.splice(index, 1);
    saveLoans();
    renderLoans();
  }
}

function renderCharts() {
  const ctx1 = document.getElementById("balanceChart").getContext("2d");
  const ctx2 = document.getElementById("pieChart").getContext("2d");

  let labels = loans.map(l => l.name);
  let outstanding = loans.map(l => (l.emi * (l.tenure - l.paidMonths)).toFixed(2));
  let emis = loans.map(l => (l.emi * l.paidMonths).toFixed(2));

  new Chart(ctx1, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Outstanding", data: outstanding, backgroundColor: "red" },
        { label: "Paid", data: emis, backgroundColor: "green" }
      ]
    }
  });

  new Chart(ctx2, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: outstanding,
        backgroundColor: ["#e84118", "#0097e6", "#44bd32", "#8c7ae6"]
      }]
    }
  });
}

document.getElementById("loanForm").addEventListener("submit", function(e) {
  e.preventDefault();
  let name = document.getElementById("loanName").value;
  let amount = parseFloat(document.getElementById("loanAmount").value);
  let rate = parseFloat(document.getElementById("loanRate").value);
  let tenure = parseInt(document.getElementById("loanTenure").value);

  let emi = calculateEMI(amount, rate, tenure);

  loans.push({
    name,
    amount,
    rate,
    tenure,
    emi,
    paidMonths: 0,
    transactions: []
  });

  saveLoans();
  renderLoans();
  this.reset();
});

renderLoans();

function renderSummary() {
  let totalLoans = loans.length;
  let totalOutstanding = loans.reduce((sum, loan) => {
    return sum + loan.emi * (loan.tenure - loan.paidMonths);
  }, 0);
  let totalMonthlyEMI = loans.reduce((sum, loan) => sum + loan.emi, 0);

  // Calculate overall closure date (latest among loans)
  let closureDates = loans.map(calculateClosureDate).filter(d => d !== "Closed");
  let overallClosure = closureDates.length > 0 
      ? closureDates.sort((a, b) => new Date(b) - new Date(a))[0]
      : "All Loans Closed";

  document.getElementById("totalLoans").textContent = `Total Loans: ${totalLoans}`;
  document.getElementById("totalOutstanding").textContent = `Total Outstanding: ₹${totalOutstanding.toFixed(2)}`;
  document.getElementById("totalMonthlyEMI").textContent = `Total Monthly EMI: ₹${totalMonthlyEMI.toFixed(2)}`;
  document.getElementById("closureDate").textContent = `Expected Loan Closure: ${overallClosure}`;
}


function calculateClosureDate(loan) {
  let remainingMonths = loan.tenure - loan.paidMonths;

  // if loan is already closed
  if (remainingMonths <= 0) return "Closed";

  // base date = last transaction date OR today
  let lastDate = loan.transactions.length > 0 
      ? new Date(loan.transactions[loan.transactions.length - 1].date)
      : new Date();

  // add remaining months
  lastDate.setMonth(lastDate.getMonth() + remainingMonths);

  return lastDate.toLocaleDateString();
}


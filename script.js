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

    card.innerHTML = `
      <h3>${loan.name}</h3>
      <p>Amount: ₹${loan.amount}</p>
      <p>Rate: ${loan.rate}%</p>
      <p>Tenure: ${loan.tenure} months</p>
      <p>EMI: ₹${loan.emi.toFixed(2)}</p>
      <p>Outstanding: ₹${outstanding}</p>
      <p>Remaining EMIs: ${remainingEMIs}</p>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
      <button onclick="payEMI(${index})">Pay EMI</button>
      <button onclick="payExtraEMI(${index})">Pay Extra EMI</button>
    `;
    loanList.appendChild(card);
  });

  renderCharts();
}

function payEMI(index) {
  if (loans[index].paidMonths < loans[index].tenure) {
    loans[index].paidMonths += 1;
    saveLoans();
    renderLoans();
  }
}

function payExtraEMI(index) {
  if (loans[index].paidMonths < loans[index].tenure) {
    loans[index].paidMonths += 2; // One extra EMI
    if (loans[index].paidMonths > loans[index].tenure) loans[index].paidMonths = loans[index].tenure;
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
  loans.push({ name, amount, rate, tenure, emi, paidMonths: 0 });
  saveLoans();
  renderLoans();
  this.reset();
});

renderLoans();

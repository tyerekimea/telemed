// Opens a new window with clean, letterhead-style HTML and triggers the
// browser's print dialog — the standard lightweight way to get a
// printable/save-as-PDF document without a PDF-generation library or a
// server-side rendering service. Used for prescriptions and investigation
// requests, on both the doctor's and patient's side.

function printDocument(title, bodyHtml) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    alert("Please allow pop-ups to print this document.");
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Georgia, serif; padding: 40px; color: #111; max-width: 640px; margin: 0 auto; }
          .brand { font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
          h1 { font-size: 22px; margin: 0 0 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
          .meta { margin-bottom: 24px; }
          .section { margin-bottom: 20px; }
          .section-label { font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .section-content { white-space: pre-wrap; font-size: 15px; line-height: 1.5; }
          .signature { margin-top: 56px; }
          .signature-line { border-top: 1px solid #333; width: 260px; padding-top: 6px; font-size: 14px; }
          .urgent { color: #b91c1c; font-weight: bold; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function formatDate(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function printPrescription({ doctorName, specialty, licenseNumber, patientName, diagnosis, medications, issuedAt }) {
  const html = `
    <div class="brand">Telemed</div>
    <h1>Prescription</h1>
    <div class="meta">
      <div class="row"><span>Patient</span><span>${patientName || "—"}</span></div>
      <div class="row"><span>Date</span><span>${formatDate(issuedAt)}</span></div>
      <div class="row"><span>Prescribing doctor</span><span>Dr. ${doctorName || "—"}${specialty ? `, ${specialty}` : ""}</span></div>
      <div class="row"><span>License / registration no.</span><span>${licenseNumber || "—"}</span></div>
    </div>
    ${diagnosis ? `
    <div class="section">
      <div class="section-label">Diagnosis</div>
      <div class="section-content">${diagnosis}</div>
    </div>` : ""}
    <div class="section">
      <div class="section-label">Rx — Medications</div>
      <div class="section-content">${medications || "—"}</div>
    </div>
    <div class="signature">
      <div class="signature-line">Dr. ${doctorName || ""}</div>
    </div>
  `;
  printDocument("Prescription", html);
}

export function printInvestigationRequest({ doctorName, specialty, licenseNumber, patientName, clinicalNotes, testsRequested, urgency, issuedAt }) {
  const html = `
    <div class="brand">Telemed</div>
    <h1>Investigation Request</h1>
    <div class="meta">
      <div class="row"><span>Patient</span><span>${patientName || "—"}</span></div>
      <div class="row"><span>Date</span><span>${formatDate(issuedAt)}</span></div>
      <div class="row"><span>Requesting doctor</span><span>Dr. ${doctorName || "—"}${specialty ? `, ${specialty}` : ""}</span></div>
      <div class="row"><span>License / registration no.</span><span>${licenseNumber || "—"}</span></div>
      <div class="row"><span>Urgency</span><span class="${urgency === "urgent" ? "urgent" : ""}">${urgency === "urgent" ? "URGENT" : "Routine"}</span></div>
    </div>
    ${clinicalNotes ? `
    <div class="section">
      <div class="section-label">Clinical notes / provisional diagnosis</div>
      <div class="section-content">${clinicalNotes}</div>
    </div>` : ""}
    <div class="section">
      <div class="section-label">Tests requested</div>
      <div class="section-content">${testsRequested || "—"}</div>
    </div>
    <div class="signature">
      <div class="signature-line">Dr. ${doctorName || ""}</div>
    </div>
  `;
  printDocument("Investigation Request", html);
}

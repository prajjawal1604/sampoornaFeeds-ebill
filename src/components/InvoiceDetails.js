import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./InvoiceDetails.css";

// ====== CONFIGURABLE VARIABLES ======
// const INVOICE_API_BASE = "http://api.sampoornafeeds.in:7048/BC230/ODataV4/";
// const COMPANY_NAME = "Sampoorna Feeds Pvt. Ltd";
// const INVOICE_ENDPOINT = `API_QRcodeforInvoice?company=%27${encodeURIComponent(
//   COMPANY_NAME
// )}%27`;

const INVOICE_API_BASE = "https://erp.sampoornafeeds.in/invoice";
// const INVOICE_API_BASE = "/odata/BC230/ODataV4/";
const AUTH_HEADER = "Basic Sm9icXVldWU6SW5kaWFAMTJnb29k";

// New: QR‐code API base
// Production QR‐code API
const PAYMENT_QR_API = "https://erp.sampoornafeeds.in/qrcode/payment";

// Local testing QR‐code API
// const PAYMENT_QR_API = "http://0.0.0.0:8000/qrcode/payment";

const tableFields = [
  { label: "Supplier GSTIN", key: "Supplier GSTIN" },
  { label: "Supplier Name", key: "Supplier name" },
  { label: "Invoice No.", key: "Invoice No." },
  { label: "Invoice Date", key: "Invoice Date" },
  { label: "Item Name", key: "Item Name" },
  { label: "Invoice Value", key: "Invoice Value" },
  { label: "CGST/SGST/IGST/CESS", key: "CGST /SGST /IGST /CESS" },
  { label: "Payee UPI ID", key: "Payee UPI ID" },
  { label: "Payee Account No.", key: "Payee Account No." },
  { label: "Payee Account IFSC", key: "Payee Account IFSC" },
];

// ====== UTILITY FUNCTION ======
function decodeBase64ToJson(base64) {
  try {
    const jsonStr = atob(base64);
    console.log("Decoded base64 string:", jsonStr);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log("[InvoiceDetails] Error decoding base64:", e);
    return null;
  }
}

// Loading Skeleton Component
const LoadingSkeleton = () => (
  <div className="loading-skeleton">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="skeleton-item">
        <div className="skeleton-row">
          <div className="skeleton-bar skeleton-bar-left skeleton-animate"></div>
          <div className="skeleton-bar skeleton-bar-right skeleton-animate"></div>
        </div>
      </div>
    ))}
  </div>
);

export default function InvoiceDetails() {
  // const { invoiceNumber } = useParams();
  const { companyName, invoiceNumber } = useParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");

  // NEW STATE FOR QR
  const [qrLoading, setQrLoading] = useState(false);
  const [qrBase64, setQrBase64] = useState(null);
  const [qrError, setQrError] = useState("");

  // 1️⃣ Fetch invoice details
  useEffect(() => {
    async function fetchInvoice() {
      setLoading(true);
      setError("");
      setInvoice(null);
      setQrBase64(null);
      setQrError("");
      setQrLoading(false);

      // const url = `${INVOICE_API_BASE}${INVOICE_ENDPOINT}`;
      const url = `${INVOICE_API_BASE}`;
      // IMPORTANT: Use the typo key as per API requirement!
      const payload = { company: companyName, inveoiceNo: invoiceNumber };

      console.log("[InvoiceDetails] Hitting Invoice API:", url, payload);

      try {
        const response = await axios.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: AUTH_HEADER,
          },
        });

        console.log("[InvoiceDetails] Raw API response:", response.data);

        const base64Value = response.data.value;
        if (!base64Value) {
          setError("No data received from API.");
          console.log("[InvoiceDetails] No base64 value in response.");
          setLoading(false);
          return;
        }

        const decoded = decodeBase64ToJson(base64Value);
        console.log("[InvoiceDetails] Decoded JSON value:", decoded);

        if (decoded && decoded.data && decoded.data[0]) {
          setInvoice(decoded.data[0]);
          console.log("[InvoiceDetails] Invoice object set:", decoded.data[0]);
        } else {
          setError("Invalid invoice data.");
          console.log("[InvoiceDetails] Decoded data missing or malformed.");
        }
      } catch (err) {
        if (err.response) {
          console.log("[InvoiceDetails] API fetch error (response):", {
            status: err.response.status,
            data: err.response.data,
            headers: err.response.headers,
          });
        } else if (err.request) {
          console.log("[InvoiceDetails] API fetch error (no response):", err.request);
        } else {
          console.log("[InvoiceDetails] API fetch error (other):", err.message);
        }
        setError("Failed to fetch invoice details.");
      }
      setLoading(false);
    }

    fetchInvoice();
  }, [invoiceNumber]);

  // 2️⃣ Once invoice is set, call QR‐code API
  useEffect(() => {
    async function fetchPaymentQr() {
      if (!invoice) return;

      setQrLoading(true);
      setQrError("");
      setQrBase64(null);

      // Extract UPI ID and amount from invoice
      const upiId = invoice["Payee UPI ID"];
      let amountVal = invoice["Invoice Value"] ?? "";
      amountVal = String(amountVal).replace(/[^\d.]/g, "");
      if (amountVal) {
        amountVal = parseFloat(amountVal).toFixed(2);
      }

      const payload = {
        upi_id: upiId,
        amount: amountVal,
      };

      console.log("[InvoiceDetails] Hitting QR API:", PAYMENT_QR_API, payload);

      try {
        const resp = await axios.post(PAYMENT_QR_API, payload, {
          headers: { "Content-Type": "application/json" },
        });

        // Expecting { qr_base64: "..." }
        if (resp.data && resp.data.qr_base64) {
          setQrBase64(resp.data.qr_base64);
          console.log("[InvoiceDetails] Received qr_base64");
        } else {
          setQrError("QR code not returned.");
          console.log("[InvoiceDetails] No qr_base64 in response");
        }
      } catch (err) {
        console.log("[InvoiceDetails] QR API error:", err);
        setQrError("Failed to generate payment QR code.");
      }
      setQrLoading(false);
    }

    fetchPaymentQr();
  }, [invoice]);

  // Helper: construct the UPI-pay link (used by the Pay Now button)
  const getUpiUrl = (invoice) => {
    if (!invoice) return "#";
    const upiId = invoice["Payee UPI ID"];
    const payeeName = encodeURIComponent(invoice["Supplier name"]);
    let amount = invoice["Invoice Value"] ?? "";
    amount = String(amount).replace(/[^\d.]/g, "");
    if (amount) amount = parseFloat(amount).toFixed(2);
    return `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&cu=INR`;
  };

  // Memoize logo src so it's only recalculated when invoice changes
  const logoSrc = useMemo(() => {
    if (invoice && invoice.CompanyLogo) {
      return `data:image/png;base64,${invoice.CompanyLogo}`;
    }
    return "/logo.png";
  }, [invoice]);

  return (
    <div className="invoice-container">
      <div className="invoice-wrapper">
        {/* Header */}
        <div className="invoice-header">
          <div className="title-with-logo">
            <img
              src={logoSrc}
              alt="Company Logo"
              className="invoice-logo"
            />
            <h1 className="invoice-title">Invoice Details<br />
                <span className="invoice-number"> #{invoiceNumber}</span></h1>
          </div>
          {/* <p className="invoice-number">#{invoiceNumber}</p> */}
        </div>

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Error State */}
        {error && (
          <div className="error-container">
            <div className="error-title">Error</div>
            <div className="error-message">{error}</div>
          </div>
        )}

        {/* Invoice Details */}
        {invoice && (
          <>
            <div className="invoice-card">
              {tableFields.map((field) => {
                let value = invoice[field.key];
                const hasValue = value && value !== "-";

                // Format Invoice Value as INR currency
                if (field.key === "Invoice Value" && hasValue) {
                  const num = Number(String(value).replace(/[^\d.]/g, ""));
                  value = isNaN(num)
                    ? value
                    : new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 2,
                      }).format(num);
                }

                return (
                  <div key={field.key} className="invoice-row">
                    <div className="invoice-label">{field.label}</div>
                    <div
                      className={`invoice-value ${
                        hasValue
                          ? field.key === "Invoice Value"
                            ? "invoice-value-amount"
                            : "invoice-value-default"
                          : "invoice-value-empty"
                      }`}
                    >
                      {hasValue ? value : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pay Button and QR Code Side by Side */}
            <div className="pay-qr-row">
              <a
                className="pay-button"
                href={getUpiUrl(invoice)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                Pay Now <br></br>&nbsp;
                {
                  invoice["Invoice Value"]
                    ? new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 2,
                      }).format(Number(String(invoice["Invoice Value"]).replace(/[^\d.]/g, "")))
                    : ""
                }
              </a>
              <div className="qr-container pay-qr-inline">
                {qrLoading && <p className="qr-status">Generating QR code…</p>}
                {qrError && <p className="qr-error">{qrError}</p>}
                {qrBase64 && (
                  <img
                    className="qr-code"
                    src={`data:image/png;base64,${qrBase64}`}
                    alt="Payment QR Code"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

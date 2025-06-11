// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InvoiceDetails from './components/InvoiceDetails';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* new route with both params */}
          <Route
            path="/invoice/:companyName/:invoiceNumber"
            element={<InvoiceDetails />}
          />
          <Route path="/" element={<div>Welcome to E-Bill App</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

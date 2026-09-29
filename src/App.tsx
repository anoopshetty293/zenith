import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ZenithHome from "./pages/ZenithHome";
import ModeSelect from "./pages/ModeSelect";
import Dashboard from "./pages/Dashboard";

import AppLayout from "./components/layout/AppLayout";
import Overview from "./pages/Overview";
import D1Dashboard from "./components/d1/D1Dashboard";
import D2Dashboard from "./components/d2/D2Dashboard";
import D3Dashboard from "./components/d3/D3Dashboard";
import TestCases from "./pages/TestCases";
import SystemArchitecture from "./pages/SystemArchitecture";
import About from "./pages/About";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ZENITH public shell */}
        <Route path="/" element={<ZenithHome />} />
        <Route path="/mode-select" element={<ModeSelect />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* FSOC Virtual Testbed — same Vite app / same server */}
        <Route element={<AppLayout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/d1" element={<D1Dashboard />} />
          <Route path="/d2" element={<D2Dashboard />} />
          <Route path="/d3" element={<D3Dashboard />} />
          <Route path="/testcases" element={<TestCases />} />
          <Route path="/architecture" element={<SystemArchitecture />} />
          <Route path="/about" element={<About />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

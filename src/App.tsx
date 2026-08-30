import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { ScrollToTop } from "./components/ScrollToTop";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import { initAnalytics } from "./lib/analytics";
import { Home } from "./pages/Home";
import { Booking } from "./pages/Booking";
import { Gallery } from "./pages/Gallery";
import { Contact } from "./pages/Contact";
import { Login } from "./pages/Login";
import { Admin } from "./pages/Admin";

export function App() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AnalyticsTracker />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}

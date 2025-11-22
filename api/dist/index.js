import express from "express";
import cors from "cors";
import { initDatabase } from "./db/database.js";
import visaRoutes from "./routes/visa.js";
import jobRoutes from "./routes/job.js";
import housingRoutes from "./routes/housing.js";
import healthcareRoutes from "./routes/healthcare.js";
import bankingRoutes from "./routes/banking.js";
import countriesRoutes from "./routes/countries.js";
const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
// Initialize database
initDatabase();
// Routes
app.use("/visa", visaRoutes);
app.use("/job", jobRoutes);
app.use("/housing", housingRoutes);
app.use("/healthcare", healthcareRoutes);
app.use("/banking", bankingRoutes);
app.use("/countries", countriesRoutes);
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// API documentation
app.get("/", (_req, res) => {
    res.json({
        name: "CasaNova API",
        version: "1.0.0",
        description: "International mobility information aggregator",
        endpoints: {
            "/visa": "Visa requirements and procedures by country",
            "/job": "Job market information for foreigners",
            "/housing": "Housing/rental information for foreigners",
            "/healthcare": "Healthcare system information",
            "/banking": "Banking and financial services for expats",
            "/countries": "List of supported countries",
        },
    });
});
app.listen(PORT, () => {
    console.log(`CasaNova API running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
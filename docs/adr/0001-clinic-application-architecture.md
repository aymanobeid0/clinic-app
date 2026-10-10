# Modular monolith with isolated clinics and live notifications

Accepted by the owner on 2026-10-10. Use one repository with a React/TypeScript SPA, an Express/TypeScript modular monolith, shared Zod transport contracts, and PostgreSQL/Prisma; organize business behavior behind small module interfaces. A shared application/database isolates clinic records, while SSE signals authorized browsers to refresh through REST. This keeps connected clinical/billing transactions and VPS maintenance manageable; layered organization was considered for familiarity and microservices for independent deployment, but their change locality or operational costs fit this pilot less well.

The implementation design and remaining technical gates are in ../architecture/application-architecture.md. Production rollout and recovery feasibility remain separate decisions.

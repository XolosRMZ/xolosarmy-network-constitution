# xolosArmy Network Constitution
Repositorio canónico de gobernanza para xolosArmy Network State (xNS).
La Constitución define la Capa Humana (HLP) como soberanía de objetivo, restricción y finalidad.

## Estructura del repositorio
- [Constitución](constitution/v1/)
- [Enmiendas](amendments/)
- [RFC (Propuestas)](rfc/)
- [Ratificación (hashes / TXIDs)](ratification/)

## Índice
- [Objetivo](#objetivo)
- [Documentos](#documentos)
- [Cómo proponer cambios](#cómo-proponer-cambios)
- [Compliance para Agentes](#compliance-para-agentes)
- [Proceso de decisión](#proceso-de-decisión)
- [Versionado constitucional](#versionado-constitucional)
- [Ratificación](#ratificación)
- [Licencia](#licencia)

## Objetivo
Establecer reglas verificables para que:
- IA ejecute
- Cripto recuerde
- Humanos elijan el vector

## Documentos
- Constitución v1: [constitution/v1/xolosarmy-network-constitution-v1.md](constitution/v1/xolosarmy-network-constitution-v1.md)

## Cómo proponer cambios
1. Crea una RFC desde: [rfc/TEMPLATE.md](rfc/TEMPLATE.md)
2. Abre PR con tu RFC numerada `RFC-XXXX`
3. Sigue el periodo de revisión pública y quórums definidos en la Constitución
4. Si se aprueba, se implementa y se registra en ratification/

## Compliance para Agentes
Los agentes de IA que operen dentro de xolosArmy Network State deben tratar la Constitución como capa normativa: define objetivos permitidos, límites inviolables, niveles de autonomía (A0–A3), quórums (RMZ/Tonalli/Obsidiana) y requisitos de timelock. Antes de ejecutar, recomendar ejecución o automatizar cualquier flujo, el agente debe evaluar la propuesta (RFC) contra las restricciones constitucionales aplicables.

Como salida mínima, cada RFC debe incluir un veredicto compacto de cumplimiento (PASS/FAIL) con razones breves y referencias a artículos relevantes. Si el veredicto es FAIL, el agente debe proponer mitigaciones concretas (cambios de alcance, límites de gasto, auditoría, timelock, downgrade de autonomía, etc.) o elevar el caso a revisión humana cuando corresponda.

En decisiones de impacto medio o crítico, los agentes deben verificar explícitamente el tipo (I/II/III), el nivel agentivo (A0–A3) y el candado requerido (RMZ/Tonalli/Obsidiana) antes de continuar. La finalidad sin deliberación está prohibida salvo régimen de emergencia definido en la propia Constitución.

## Proceso de decisión
RFC → Mapeo de riesgo → Revisión pública → Votación → Timelock → Ejecución → Post-mortem

## Versionado constitucional
- Se usa SemVer: vMAJOR.MINOR.PATCH
- MAJOR: cambios de principios/estructura
- MINOR: artículos nuevos o ampliaciones compatibles
- PATCH: correcciones de redacción sin cambio de sentido

## Ratificación
Los hashes/TXIDs canónicos se registran en:
- [ratification/REGISTRY.md](ratification/REGISTRY.md)

## Licencia
Por definir (se puede añadir más adelante).

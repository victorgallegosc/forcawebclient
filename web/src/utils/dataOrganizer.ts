import { ModuleData, TablaParsed } from '../../../sdk/src';

// Organize module data into groups by jornada/fecha/grupo when possible
export function organizeModuleData(moduleKey: string, moduleData: ModuleData) {
    // Default: each table as its own group with no title
    if (!moduleData || !moduleData.tables || moduleData.tables.length === 0) return [] as { title?: string; tables: ModuleData['tables'] }[];

    // Try to detect common grouping fields in rows: 'jornada', 'fecha', 'grupo'
    if (moduleKey === 'resultados') {
        // group by jornada if present
        const map = new Map<string, TablaParsed[]>();
        moduleData.tables.forEach(tbl => {
            tbl.rows.forEach((r) => {
                const key = (r['jornada'] || r['Jornada'] || r['fecha'] || r['Fecha'] || 'General').toString();
                const copy: TablaParsed = { ...tbl, rows: [r] } as TablaParsed;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(copy);
            });
        });
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        for (const [k, v] of map.entries()) out.push({ title: k, tables: v });
        return out;
    }

    if (moduleKey === 'posiciones' || moduleKey === 'goleo') {
        // The parser may emit special rows like { Grupo: 'Grupo 4 A' } as separators.
        // We'll iterate tables and split rows into groups when we detect these separator rows.
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        moduleData.tables.forEach(tbl => {
            // initialize current group from table meta title when available
            let currentTitle = (tbl.meta && tbl.meta.title) ? tbl.meta.title : 'General';
            let currentTable: TablaParsed = { ...tbl, rows: [] } as TablaParsed;

            const pushCurrent = () => {
                // skip empty group (no rows)
                if (currentTable.rows.length > 0) {
                    out.push({ title: currentTitle, tables: [currentTable] });
                }
            };

            tbl.rows.forEach(r => {
                // detect group separator produced by parser
                const keys = Object.keys(r || {});
                if (keys.length === 1 && (keys[0].toLowerCase() === 'grupo' || keys[0] === 'Grupo')) {
                    // push previous group and start new one
                    pushCurrent();
                    currentTitle = (r[keys[0]] || 'General').toString();
                    // filter out footer-like groups
                    const low = currentTitle.toLowerCase();
                    if (low.includes('tabla posiciones') || (low.includes('tabla') && low.includes('etapa'))) {
                        // ignore as group title (likely footer) - revert to meta title if present
                        currentTitle = (tbl.meta && tbl.meta.title) ? tbl.meta.title : 'General';
                    }
                    currentTable = { ...tbl, rows: [] } as TablaParsed;
                } else {
                    // normal data row: append to current table
                    currentTable.rows.push(r);
                }
            });

            // push last group
            pushCurrent();
        });
        return out;
    }

    if (moduleKey === 'rol') {
        // group by fecha or jornada
        const map = new Map<string, TablaParsed[]>();
        moduleData.tables.forEach(tbl => {
            tbl.rows.forEach(r => {
                const key = (r['fecha'] || r['Fecha'] || r['jornada'] || r['Jornada'] || 'General').toString();
                const copy: TablaParsed = { ...tbl, rows: [r] } as TablaParsed;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(copy);
            });
        });
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        for (const [k, v] of map.entries()) out.push({ title: k, tables: v });
        return out;
    }

    // fallback: return each table as a group
    return moduleData.tables.map(t => ({ title: t.meta.title || undefined, tables: [t] }));
}

import sqlite3

DB_PATH = 'pastagens.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check raw data
cursor.execute('''
    SELECT p.id, p.nome as piquete_nome, p.estado,
           l.nome as lote_nome, l.quantidade, l.ativo
    FROM piquetes p
    LEFT JOIN lotes l ON p.id = l.piquete_atual_id AND l.ativo = 1
    WHERE p.fazenda_id = 1 AND p.ativo = 1
''')

rows = cursor.fetchall()
print(f"Total rows: {len(rows)}")
for r in rows:
    print(f"  Piquete {r['id']} ({r['piquete_nome']}): estado={r['estado']}, lote={r['lote_nome']}, ativo={r['ativo']}")

conn.close()

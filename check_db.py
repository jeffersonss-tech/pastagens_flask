import sqlite3
c = sqlite3.connect('pastagens.db')
cur = c.cursor()
cur.execute("PRAGMA table_info(fazendas)")
print("=== fazendas ===")
for col in cur.fetchall():
    print(col)

print("\n=== sample fazendas ===")
cur.execute("SELECT id, nome, usuario_id FROM fazendas LIMIT 5")
for row in cur.fetchall():
    print(row)

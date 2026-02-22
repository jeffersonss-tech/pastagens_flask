import sqlite3
c = sqlite3.connect('pastagens.db')
cur = c.cursor()

print("=== Permissoes ===")
cur.execute("SELECT * FROM user_farm_permissions")
for row in cur.fetchall():
    print(row)

print("\n=== Usuarios operadores ===")
cur.execute("SELECT id, username, role FROM usuarios WHERE role = 'operador'")
for row in cur.fetchall():
    print(row)

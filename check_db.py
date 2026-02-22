import sqlite3
c = sqlite3.connect('pastagens.db')
cur = c.cursor()

# Ver estrutura das tabelas
cur.execute("PRAGMA table_info(usuarios)")
print("=== usuarios ===")
for col in cur.fetchall():
    print(col)

print("\n=== user_farm_permissions ===")
cur.execute("PRAGMA table_info(user_farm_permissions)")
for col in cur.fetchall():
    print(col)

print("\n=== permissões atuais ===")
cur.execute("SELECT * FROM user_farm_permissions LIMIT 10")
for row in cur.fetchall():
    print(row)

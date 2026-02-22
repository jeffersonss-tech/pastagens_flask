import sqlite3
import os

# Caminho absoluto para garantir o banco correto
DB_PATH = "C:/projetos/pastagens_flask/instance/database.db"
if not os.path.exists(DB_PATH):
    DB_PATH = "C:/projetos/pastagens_flask/pastagens.db"

def migrate():
    print(f"Iniciando migração no banco: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("ERRO: Banco de dados não encontrado!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Criar tabela de permissões (user_farm_permissions)
        print("Criando tabela user_farm_permissions...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_farm_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                farm_id INTEGER NOT NULL,
                created_at TEXT,
                FOREIGN KEY (user_id) REFERENCES usuarios(id),
                FOREIGN KEY (farm_id) REFERENCES fazendas(id)
            )
        ''')

        # 2. Adicionar campo 'email' na tabela usuarios
        cursor.execute('PRAGMA table_info(usuarios)')
        colunas_users = [r[1] for r in cursor.fetchall()]
        
        if 'email' not in colunas_users:
            print("Adicionando coluna email em usuarios...")
            cursor.execute('ALTER TABLE usuarios ADD COLUMN email TEXT')
        
        # 3. Migrar donos atuais para a nova lógica de permissão
        print("Migrando permissões baseadas em usuario_id atual...")
        cursor.execute('SELECT id, usuario_id FROM fazendas WHERE usuario_id IS NOT NULL')
        fazendas = cursor.fetchall()
        for f_id, u_id in fazendas:
            cursor.execute('SELECT id FROM user_farm_permissions WHERE user_id = ? AND farm_id = ?', (u_id, f_id))
            if not cursor.fetchone():
                cursor.execute('INSERT INTO user_farm_permissions (user_id, farm_id, created_at) VALUES (?, ?, datetime("now"))', (u_id, f_id))

        conn.commit()
        print("Migração concluída com sucesso!")
    except Exception as e:
        conn.rollback()
        print(f"Erro na migração: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

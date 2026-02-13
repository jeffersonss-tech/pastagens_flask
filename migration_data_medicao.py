"""
Migration para adicionar campo data_medicao na tabela piquetes
Executar: python migration_data_medicao.py
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "pastagens.db")

def migrar():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Verificar se a coluna já existe
    cursor.execute("PRAGMA table_info(piquetes)")
    colunas = [c[1] for c in cursor.fetchall()]
    
    if 'data_medicao' not in colunas:
        print("Adicionando coluna data_medicao...")
        cursor.execute("ALTER TABLE piquetes ADD COLUMN data_medicao TEXT")
        
        # Para dados existentes, usar created_at como fallback
        cursor.execute("UPDATE piquetes SET data_medicao = created_at WHERE altura_real_medida IS NOT NULL")
        
        conn.commit()
        print("Coluna adicionada e dados migrados!")
    else:
        print("Coluna data_medicao ja existe.")
    
    conn.close()

if __name__ == "__main__":
    migrar()

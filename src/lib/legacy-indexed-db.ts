import type { Account, ImportResult } from '../types'
import { importAccounts } from './account-api'

const MIGRATION_KEY = 'aov-neon-migration-v1'

function readLegacyAccounts(): Promise<Account[]> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      resolve([])
      return
    }

    const request = indexedDB.open('AovAccountManager')
    request.onerror = () => resolve([])
    request.onupgradeneeded = () => {
      request.transaction?.abort()
      resolve([])
    }
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('accounts')) {
        database.close()
        resolve([])
        return
      }

      const transaction = database.transaction('accounts', 'readonly')
      const getAll = transaction.objectStore('accounts').getAll()
      getAll.onerror = () => resolve([])
      getAll.onsuccess = () => {
        database.close()
        resolve(getAll.result as Account[])
      }
    }
  })
}

export async function migrateLegacyIndexedDb(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return

  const accounts = await readLegacyAccounts()
  if (accounts.length) {
    const result: ImportResult = {
      accounts,
      errors: [],
      sourceSheet: 'IndexedDB legacy migration',
    }
    await importAccounts(result, false)
  }

  localStorage.setItem(MIGRATION_KEY, new Date().toISOString())
}

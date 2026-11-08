import { describe, it, expect } from 'vitest';
import {
  getSuppliers,
  getPurchases,
  getAccountsPayable,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
  deleteSupplier,
} from '@/lib/purchases/purchases-service';

describe('Resiliencia de carga y operaciones de proveedores', () => {
  const businessId = 'a8e2612f-4acc-4c84-a420-220131b70d66';

  it('no arroja error al consultar módulo con datos vacíos o sin tabla en cloud', async () => {
    const sups = await getSuppliers(businessId);
    expect(Array.isArray(sups)).toBe(true);

    const purch = await getPurchases(businessId, { period: 'all' });
    expect(Array.isArray(purch)).toBe(true);

    const ap = await getAccountsPayable(businessId, { status: 'all' });
    expect(Array.isArray(ap)).toBe(true);
  });

  it('permite registrar, consultar, editar y desactivar un proveedor en este negocio', async () => {
    // 1. Registro con datos mínimos
    const testName = `Distribuidora Test ${Date.now()}`;
    const created = await createSupplier(businessId, {
      name: testName,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe(testName);
    expect(created.status).toBe('active');

    // 2. Comprobar que no permite duplicados
    await expect(
      createSupplier(businessId, { name: testName })
    ).rejects.toThrow(/Ya existe un proveedor registrado/);

    // 3. Comprobar que aparece en getSuppliers
    const list = await getSuppliers(businessId);
    const found = list.find((s) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(testName);

    // 4. Edición de datos (contacto y NIT)
    const updated = await updateSupplier(businessId, created.id, {
      contactName: 'Juan Pérez',
      phone: '3001234567',
      taxId: '900999888-1',
    });
    expect(updated.contactName).toBe('Juan Pérez');
    expect(updated.phone).toBe('3001234567');
    expect(updated.taxId).toBe('900999888-1');

    // 5. Desactivación lógica
    const deactivated = await toggleSupplierStatus(businessId, created.id, 'inactive');
    expect(deactivated.status).toBe('inactive');

    // 6. Limpieza del registro de prueba
    await deleteSupplier(businessId, created.id);
    const afterDelete = await getSuppliers(businessId);
    expect(afterDelete.find((s) => s.id === created.id)).toBeUndefined();
  });
});

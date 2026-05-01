import { UserCog, Plus, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAllUsers } from '@/lib/queries/users';
import { ROLE_LABEL, type UserRole } from '@/lib/roles';
import { requireRole } from '@/lib/session';
import { cn } from '@/lib/utils';

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER: 'bg-kartini-green text-white border-0',
  ADMIN: 'bg-kartini-orange text-white border-0',
  SUPERVISOR: 'bg-blue-600 text-white border-0',
  STAF_GUDANG: 'bg-stone-200 text-stone-700 border-0',
};

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default async function UsersPage() {
  await requireRole(['OWNER']);
  const users = await getAllUsers();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-kartini-green" />
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {users.length.toLocaleString('id-ID')} pengguna terdaftar
          </p>
        </div>

        <button
          type="button"
          disabled
          title="Tambah user akan dibuat di Phase 2 — sementara user otomatis ter-create saat login Google pertama kali"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-kartini-green text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengguna
        </button>
      </div>

      {users.length === 0 ? (
        <Card className="border-stone-200 shadow-soft-sm py-12 text-center">
          <CardContent>
            <UserCog className="w-10 h-10 mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-500">
              Belum ada user terdaftar. User akan otomatis muncul setelah login Google pertama kali.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Pengguna
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Lokasi
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Bergabung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => {
                  const role = u.role as UserRole;
                  return (
                    <tr key={u.id} className="hover:bg-stone-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-9 h-9 flex-shrink-0">
                            <AvatarImage src={u.image ?? undefined} alt={u.name} />
                            <AvatarFallback className="bg-kartini-green text-white text-xs font-semibold">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-stone-900 truncate">{u.name}</div>
                            <div className="text-xs text-stone-500 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn(ROLE_BADGE[role])}>{ROLE_LABEL[role]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.assignedLocations && u.assignedLocations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.assignedLocations.map((loc) => (
                              <Badge
                                key={loc}
                                variant="outline"
                                className="text-[10px] border-stone-200"
                              >
                                {loc}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <Badge className="bg-kartini-green-light text-kartini-green-dark hover:bg-kartini-green-light border-0">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0">
                            Nonaktif
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {dateFmt.format(new Date(u.createdAt))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-stone-100">
            {users.map((u) => {
              const role = u.role as UserRole;
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={u.image ?? undefined} alt={u.name} />
                      <AvatarFallback className="bg-kartini-green text-white text-xs font-semibold">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-900 truncate">{u.name}</div>
                      <div className="text-xs text-stone-500 truncate">{u.email}</div>
                    </div>
                    <Badge className={cn(ROLE_BADGE[role], 'flex-shrink-0')}>
                      {ROLE_LABEL[role]}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {u.isActive ? (
                      <Badge className="bg-kartini-green-light text-kartini-green-dark hover:bg-kartini-green-light border-0">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0">
                        Nonaktif
                      </Badge>
                    )}
                    {u.assignedLocations?.map((loc) => (
                      <Badge
                        key={loc}
                        variant="outline"
                        className="text-[10px] border-stone-200"
                      >
                        {loc}
                      </Badge>
                    ))}
                    <span className="text-stone-400 ml-auto">
                      {dateFmt.format(new Date(u.createdAt))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50 shadow-soft-sm py-4 gap-2">
        <CardContent className="px-4">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <p>
              <strong>Tip:</strong> Untuk mengubah role atau lokasi user, edit langsung via
              Drizzle Studio (
              <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                pnpm db:studio
              </code>
              ). UI manage role akan dibangun di Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

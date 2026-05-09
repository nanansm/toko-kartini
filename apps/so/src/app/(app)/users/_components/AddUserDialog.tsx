'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createUser, type NewUserRole } from '@/lib/auth/user-management';

const ROLES: { value: NewUserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'STAF_GUDANG', label: 'Staf Gudang' },
];

export function AddUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<NewUserRole>('STAF_GUDANG');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('STAF_GUDANG');
    setShowPassword(false);
  }

  async function handleSubmit() {
    if (!name || !email || !password) {
      toast.error('Semua field wajib diisi');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setSubmitting(true);
    const result = await createUser({ name, email, password, role });
    setSubmitting(false);

    if (result.ok) {
      toast.success(`User ${name} berhasil dibuat`);
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengguna
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          <DialogDescription>
            User bisa login dengan email + password yang Anda tentukan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-user-name" className="text-sm font-medium text-stone-700">
              Nama Lengkap *
            </label>
            <input
              id="new-user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Budi Santoso"
              className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-user-email" className="text-sm font-medium text-stone-700">
              Email *
            </label>
            <input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="timso@tokokartini.com"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-user-password" className="text-sm font-medium text-stone-700">
              Password *
            </label>
            <div className="relative">
              <input
                id="new-user-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Sampaikan password ini ke user secara langsung.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Role *</label>
            <Select value={role} onValueChange={(v) => setRole(v as NewUserRole)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !name || !email || !password}
            className="h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Buat User
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

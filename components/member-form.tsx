import { saveMember } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { AppRole } from "@/lib/authz";
import type { Member } from "@/lib/workspace";

export function MemberForm({ actorRole, member }: { actorRole: AppRole; member?: Member }) {
  const owner = actorRole === "owner";
  return <form action={saveMember} className="grid gap-5">
    {member && <input type="hidden" name="member_id" value={member.id} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="member-name">Nombre</Label><Input id="member-name" name="display_name" defaultValue={member?.display_name} required minLength={2} maxLength={100} className="h-11 bg-white text-[16px]" /></div>
      <div className="space-y-2"><Label htmlFor="member-email">Correo de acceso</Label><Input id="member-email" name="email" type="email" defaultValue={member?.email} required maxLength={254} className="h-11 bg-white text-[16px]" /></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="member-role">Rol en la aplicación</Label><NativeSelect id="member-role" name="role" defaultValue={member?.role ?? "leader"} className="h-11 w-full bg-white text-[16px]">
        {owner && <NativeSelectOption value="admin">Administrador del equipo</NativeSelectOption>}
        <NativeSelectOption value="leader">Líder de opinión</NativeSelectOption>
        {owner && <NativeSelectOption value="consultant">Consultor Anima Praxis</NativeSelectOption>}
        <NativeSelectOption value="observer">Observador</NativeSelectOption>
      </NativeSelect></div>
      <div className="space-y-2"><Label htmlFor="member-status">Estado interno</Label><NativeSelect id="member-status" name="status" defaultValue={member?.status ?? "active"} className="h-11 w-full bg-white text-[16px]"><NativeSelectOption value="active">Activo</NativeSelectOption><NativeSelectOption value="inactive">Inactivo</NativeSelectOption></NativeSelect></div>
    </div>
    <div className="space-y-4 rounded-xl border border-[#dbe5e7] bg-[#f7faf9] p-4">
      <div className="flex items-start gap-3"><Checkbox id="is-leader" name="is_leader" defaultChecked={Boolean(member?.is_leader)} className="mt-1" /><div><Label htmlFor="is-leader" className="text-[14px]">Integra el Equipo de Alto Nivel</Label><p className="mt-1 text-[13px] leading-5 text-[#667d88]">Máximo cinco líderes de opinión. Marcar este campo no concede acceso al Site.</p></div></div>
      {owner && <div className="flex items-start gap-3"><Checkbox id="is-director" name="is_director" defaultChecked={Boolean(member?.is_director)} className="mt-1" /><div><Label htmlFor="is-director" className="text-[14px]">Gerente general o máximo director</Label><p className="mt-1 text-[13px] leading-5 text-[#667d88]">Su participación es obligatoria para el quórum de validación.</p></div></div>}
    </div>
    <div className="flex items-center justify-end"><Button type="submit" className="h-11 rounded-lg px-5 text-[14px]">{member ? "Guardar cambios" : "Agregar integrante"}</Button></div>
  </form>;
}

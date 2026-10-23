import { useId } from "react"

export function FotoProfilo({ nome, foto, onChange }: { nome: string; foto?: string; onChange?: (foto: string | undefined) => void }) {
  const id = useId()
  return <div className="foto-profilo-campo">
    <div className="foto-profilo">{foto ? <img src={foto} alt={`Foto di ${nome}`} /> : <span aria-label="Foto profilo non impostata">{nome[0]?.toUpperCase() || "?"}</span>}</div>
    {onChange && <><label htmlFor={id}>Carica foto profilo</label><input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { e.target.setCustomValidity("Scegli un'immagine PNG, JPEG o WebP di massimo 1 MB."); e.target.reportValidity(); e.target.value = ""; return }
      e.target.setCustomValidity("")
      const reader = new FileReader()
      reader.onload = () => { if (typeof reader.result === "string") onChange(reader.result) }
      reader.readAsDataURL(file)
    }} /><small>PNG, JPEG o WebP, massimo 1 MB · ritaglio quadrato centrale</small>{foto && <button type="button" className="secondario" onClick={() => onChange(undefined)}>Rimuovi foto</button>}</>}
  </div>
}

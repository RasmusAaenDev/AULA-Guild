import { AddCharacterForm } from './AddCharacterForm';

export default function NewCharacterPage() {
  return (
    <>
      <h1>Tilføj karakter</h1>
      <p className="muted">Karakteren slås op i armory og skal findes på WoW Forever. Er den i guilden, markeres den med en stjerne (★). Klasse, spec og item level hentes automatisk.</p>
      <AddCharacterForm />
    </>
  );
}

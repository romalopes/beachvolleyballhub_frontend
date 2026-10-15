import type { Division } from '../api';

interface DivisionChipProps {
  division: Division;
}

export default function DivisionChip({ division }: DivisionChipProps) {
  const divisionCode = division.division_code; // from the division model, this is letter_level || division_number.toString()
  const isLetterLevel = !!division.letter_level;

  return (
    <span className={`division-chip ${isLetterLevel ? 'division-chip-letter' : 'division-chip-number'}`}>
      {divisionCode}
    </span>
  );
}
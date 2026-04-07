import type { Metadata } from 'next';
import AREncounter from './AREncounter';

export const metadata: Metadata = {
  title: 'The Field — Blackmoor',
  description: 'Step into the world.',
};

export default function ARPage() {
  return <AREncounter />;
}

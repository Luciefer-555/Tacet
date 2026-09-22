import { FileText } from 'lucide-react';
import Link from 'next/link';

interface ResearchPaper {
  id: string;
  title: string;
  authors: string;
  year: number;
  venue: string;
  url: string;
  doi?: string;
}

const researchPapers: ResearchPaper[] = [
  {
    id: '1',
    title: 'Generative AI in Computing Education: Perspectives of Students and Instructors',
    authors: 'Cynthia Zastudil et al.',
    year: 2023,
    venue: 'IEEE FIE',
    url: 'https://arxiv.org/abs/2308.04309',
    doi: '10.1109/FIE58773.2023.10343467'
  },
  {
    id: '2',
    title: 'Beyond the Benefits: A Systematic Review of the Harms and Consequences of Generative AI in Computing Education',
    authors: 'Seth Bernstein et al.',
    year: 2025,
    venue: 'arXiv',
    url: 'https://arxiv.org/abs/2510.04443'
  },
  {
    id: '3',
    title: 'Students\' Perceptions and Use of Generative AI Tools for Programming Across Different Computing Courses',
    authors: 'Hieke Keuning et al.',
    year: 2024,
    venue: 'arXiv',
    url: 'https://arxiv.org/abs/2410.06865'
  },
  {
    id: '4',
    title: 'The Impact and Application of Generative Artificial Intelligence within Education',
    authors: 'Sergio Martin Gutierrez & Rebecca Strachan',
    year: 2024,
    venue: 'IEEE Teaching Excellence Hub',
    url: 'https://teaching.ieee.org/the-impact-and-application-of-generative-artificial-intelligence-within-education/'
  },
  {
    id: '5',
    title: 'Computing Education Using Generative Artificial Intelligence',
    authors: 'F.J. Agbo',
    year: 2025,
    venue: 'ScienceDirect',
    url: 'https://www.sciencedirect.com/science/article/pii/S2666557325000254'
  }
];

export default function ResearchPaperLibrary() {
  return (
    <div className="bg-[#121212] p-6 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {researchPapers.map((paper) => (
          <div 
            key={paper.id}
            className="bg-card p-6 rounded-md border border-[#2A3D5C] hover:border-[#C8A84B]/40 transition-colors"
          >
            <h3 className="text-xl font-bold text-white mb-2">{paper.title}</h3>
            <p className="text-gray-300 text-sm mb-3">{paper.authors}</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                {paper.year} • {paper.venue}
              </span>
              <Link 
                href={paper.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-[#1DB954] text-white rounded-md hover:bg-opacity-90 transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Read More
              </Link>
            </div>
            {paper.doi && (
              <p className="text-xs text-gray-500 mt-2">
                DOI: {paper.doi}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

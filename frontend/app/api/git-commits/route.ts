import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export async function GET() {
  try {
    // Get the last 20 commits
    const { stdout } = await execAsync(
      'git log --pretty=format:"%h|%ai|%an|%s" -20',
      { cwd: process.cwd() }
    );

    const commits: GitCommit[] = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, date, author, ...messageParts] = line.split('|');
        return {
          hash: hash || '',
          date: date || '',
          author: author || '',
          message: messageParts.join('|') || '',
        };
      });

    return NextResponse.json({ commits });
  } catch (error: any) {
    console.error('Failed to fetch git commits:', error);
    // Return empty array on error (e.g., not a git repo, git not available)
    return NextResponse.json({ commits: [] });
  }
}


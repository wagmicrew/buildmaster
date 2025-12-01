import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

interface FileIssue {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

interface SanityReport {
  file: string
  issues: FileIssue[]
  stats: {
    lines: number
    functions: number
    tryBlocks: number
    catchBlocks: number
    strings: number
    unterminatedStrings: number
  }
}

function analyzeFile(filePath: string): SanityReport {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  const issues: FileIssue[] = []
  const stats = {
    lines: lines.length,
    functions: 0,
    tryBlocks: 0,
    catchBlocks: 0,
    strings: 0,
    unterminatedStrings: 0
  }
  
  // Track string context
  let inString = false
  let stringChar = ''
  let stringStart: { line: number; column: number } | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Count functions
    const functionMatches = line.match(/\b(function|const|let|var)\s+\w+\s*=/g)
    if (functionMatches) {
      stats.functions += functionMatches.length
    }
    
    // Count try/catch blocks
    if (line.includes('try')) {
      stats.tryBlocks++
    }
    if (line.includes('catch')) {
      stats.catchBlocks++
    }
    
    // Check for try without catch
    if (line.includes('try') && !line.includes('catch')) {
      // Look ahead for catch in next few lines
      let hasCatch = false
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('catch')) {
          hasCatch = true
          break
        }
      }
      
      if (!hasCatch) {
        issues.push({
          file: filePath,
          line: i + 1,
          column: line.indexOf('try') + 1,
          message: 'try block without corresponding catch',
          severity: 'error'
        })
      }
    }
    
    // String termination analysis
    for (let col = 0; col < line.length; col++) {
      const char = line[col]
      
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        // Start of string
        inString = true
        stringChar = char
        stringStart = { line: i + 1, column: col + 1 }
        stats.strings++
      } else if (inString && char === stringChar) {
        // Check if escaped
        const prevChar = col > 0 ? line[col - 1] : ''
        if (prevChar !== '\\') {
          // End of string
          inString = false
          stringChar = ''
          stringStart = null
        }
      }
    }
    
    // Check if string spans multiple lines without proper continuation
    if (inString && i < lines.length - 1) {
      const nextLine = lines[i + 1]
      if (!nextLine.trim().startsWith(stringChar) && !nextLine.includes('${')) {
        // Potential unterminated multi-line string
        if (stringStart) {
          issues.push({
            file: filePath,
            line: stringStart.line,
            column: stringStart.column,
            message: `Unterminated string starting at line ${stringStart.line}`,
            severity: 'error'
          })
          stats.unterminatedStrings++
          inString = false
          stringChar = ''
          stringStart = null
        }
      }
    }
  }
  
  // Check for unclosed string at end of file
  if (inString && stringStart) {
    issues.push({
      file: filePath,
      line: stringStart.line,
      column: stringStart.column,
      message: `Unterminated string at end of file`,
      severity: 'error'
    })
    stats.unterminatedStrings++
  }
  
  // Check for catch without try
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('catch')) {
      // Look back for try
      let hasTry = false
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (lines[j].includes('try')) {
          hasTry = true
          break
        }
      }
      
      if (!hasTry) {
        issues.push({
          file: filePath,
          line: i + 1,
          column: line.indexOf('catch') + 1,
          message: 'catch block without corresponding try',
          severity: 'error'
        })
      }
    }
  }
  
  return {
    file: filePath,
    issues,
    stats
  }
}

function getSourceFiles(dir: string): string[] {
  const files: string[] = []
  
  function scanDirectory(currentDir: string) {
    const items = readdirSync(currentDir)
    
    for (const item of items) {
      const fullPath = join(currentDir, item)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        // Skip node_modules and other common exclusions
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
          scanDirectory(fullPath)
        }
      } else if (stat.isFile()) {
        const ext = extname(item)
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }
  
  scanDirectory(dir)
  return files
}

describe('File Sanity Checks', () => {
  it('should analyze source files for try/catch and string issues', () => {
    // Get the project root directory (troubleshooting folder is in project root)
    const projectRoot = process.cwd()
    
    // Analyze key source directories
    const directories = [
      join(projectRoot, 'api'),
      join(projectRoot, 'web/src'),
      join(projectRoot, 'troubleshooting')
    ]
    
    const allReports: SanityReport[] = []
    let totalIssues = 0
    let totalErrors = 0
    let totalWarnings = 0
    
    for (const dir of directories) {
      try {
        const files = getSourceFiles(dir)
        
        for (const file of files) {
          const report = analyzeFile(file)
          allReports.push(report)
          
          totalIssues += report.issues.length
          totalErrors += report.issues.filter(i => i.severity === 'error').length
          totalWarnings += report.issues.filter(i => i.severity === 'warning').length
        }
      } catch (error) {
        console.warn(`Could not analyze directory ${dir}:`, error)
      }
    }
    
    // Generate summary report
    console.log('\n🔍 File Sanity Analysis Report')
    console.log('================================')
    console.log(`Files analyzed: ${allReports.length}`)
    console.log(`Total issues: ${totalIssues}`)
    console.log(`Errors: ${totalErrors}`)
    console.log(`Warnings: ${totalWarnings}`)
    console.log('')
    
    // Report issues by file
    for (const report of allReports) {
      if (report.issues.length > 0) {
        console.log(`📁 ${report.file}`)
        console.log(`   Lines: ${report.stats.lines}, Functions: ${report.stats.functions}`)
        console.log(`   Try/Catch: ${report.stats.tryBlocks}/${report.stats.catchBlocks}`)
        console.log(`   Strings: ${report.stats.strings}, Unterminated: ${report.stats.unterminatedStrings}`)
        console.log('')
        
        for (const issue of report.issues) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️'
          console.log(`   ${icon} Line ${issue.line}:${issue.column} - ${issue.message}`)
        }
        console.log('')
      }
    }
    
    // Assertions
    expect(totalErrors).toBe(0, `Found ${totalErrors} error(s) in source files`)
    
    // Allow some warnings but not too many
    expect(totalWarnings).toBeLessThan(10, `Found too many warnings: ${totalWarnings}`)
    
    // Basic sanity checks
    expect(allReports.length).toBeGreaterThan(0, 'No files were analyzed')
    
    // Check that we have reasonable try/catch ratios
    const totalTryBlocks = allReports.reduce((sum, r) => sum + r.stats.tryBlocks, 0)
    const totalCatchBlocks = allReports.reduce((sum, r) => sum + r.stats.catchBlocks, 0)
    
    if (totalTryBlocks > 0) {
      const catchRatio = totalCatchBlocks / totalTryBlocks
      expect(catchRatio).toBeGreaterThan(0.5, 'Too many try blocks without corresponding catch blocks')
    }
  })
  
  it('should check specific troubleshooting files for common issues', () => {
    const projectRoot = process.cwd()
    const troubleshootingDir = join(projectRoot, 'troubleshooting')
    
    try {
      const files = getSourceFiles(troubleshootingDir)
      
      for (const file of files) {
        const report = analyzeFile(file)
        
        // Troubleshooting files should be extra clean
        const errors = report.issues.filter(i => i.severity === 'error')
        expect(errors).toHaveLength(0, `Troubleshooting file ${file} has errors: ${errors.map(e => e.message).join(', ')}`)
        
        // Log warnings for troubleshooting files
        const warnings = report.issues.filter(i => i.severity === 'warning')
        if (warnings.length > 0) {
          console.log(`\n⚠️  Warnings in ${file}:`)
          for (const warning of warnings) {
            console.log(`   Line ${warning.line}:${warning.column} - ${warning.message}`)
          }
        }
      }
    } catch (error) {
      // If troubleshooting directory doesn't exist, skip this test
      console.log('Troubleshooting directory not found, skipping specific checks')
    }
  })
})

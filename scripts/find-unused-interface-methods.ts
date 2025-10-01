#!/usr/bin/env tsx

import { Project, SyntaxKind, InterfaceDeclaration } from 'ts-morph';
import * as path from 'path';

interface MethodInfo {
    name: string;
    interfaceName: string;
    filePath: string;
    lineNumber: number;
    implementations: number;
    invocations: number;
    isDeprecated: boolean;
}

interface InterfaceReport {
    interfaceName: string;
    filePath: string;
    methods: MethodInfo[];
}

const TARGET_INTERFACES = [
    'IFirestoreWriter',
    'IFirestoreReader',
    'IAuthService',
];

function analyzeProject(tsconfigPath: string): InterfaceReport[] {
    console.log('Loading TypeScript project...');
    const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
    });

    const reports: InterfaceReport[] = [];

    console.log('Finding target interfaces...');
    const sourceFiles = project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
        if (sourceFile.getFilePath().includes('node_modules')) {
            continue;
        }

        const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);

        for (const interfaceDecl of interfaces) {
            const interfaceName = interfaceDecl.getName();

            if (!TARGET_INTERFACES.includes(interfaceName)) {
                continue;
            }

            console.log(`\nAnalyzing interface: ${interfaceName}`);
            const methods = analyzeInterfaceMethods(interfaceDecl, project);

            reports.push({
                interfaceName,
                filePath: sourceFile.getFilePath(),
                methods,
            });
        }
    }

    return reports;
}

function analyzeInterfaceMethods(interfaceDecl: InterfaceDeclaration, project: Project): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const interfaceName = interfaceDecl.getName();
    const sourceFile = interfaceDecl.getSourceFile();

    const methodSignatures = interfaceDecl.getDescendantsOfKind(SyntaxKind.MethodSignature);

    for (const methodSig of methodSignatures) {
        const methodName = methodSig.getName();
        const lineNumber = methodSig.getStartLineNumber();

        const jsDocs = methodSig.getJsDocs();
        const isDeprecated = jsDocs.some(doc =>
            doc.getTags().some(tag => tag.getTagName() === 'deprecated')
        );

        const implementations = countImplementations(interfaceName, methodName, project);
        const invocations = countInvocations(methodName, project);

        console.log(`  - ${methodName}: ${implementations} implementations, ${invocations} invocations${isDeprecated ? ' (DEPRECATED)' : ''}`);

        methods.push({
            name: methodName,
            interfaceName,
            filePath: sourceFile.getFilePath(),
            lineNumber,
            implementations,
            invocations,
            isDeprecated,
        });
    }

    return methods;
}

function countImplementations(interfaceName: string, methodName: string, project: Project): number {
    let count = 0;

    for (const sourceFile of project.getSourceFiles()) {
        if (sourceFile.getFilePath().includes('node_modules')) {
            continue;
        }

        const classes = sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration);

        for (const classDecl of classes) {
            const implementsClauses = classDecl.getImplements();
            const implementsTarget = implementsClauses.some(clause =>
                clause.getText().includes(interfaceName)
            );

            if (implementsTarget) {
                const method = classDecl.getMethod(methodName);
                if (method) {
                    count++;
                }
            }
        }
    }

    return count;
}

function countInvocations(methodName: string, project: Project): number {
    let count = 0;

    for (const sourceFile of project.getSourceFiles()) {
        if (sourceFile.getFilePath().includes('node_modules')) {
            continue;
        }

        const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

        for (const callExpr of callExpressions) {
            const expression = callExpr.getExpression();

            if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
                const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
                const name = propAccess.getName();

                if (name === methodName) {
                    count++;
                }
            }
        }
    }

    return count;
}

function generateReport(reports: InterfaceReport[]): void {
    console.log('\n\n' + '='.repeat(80));
    console.log('UNUSED INTERFACE METHODS REPORT');
    console.log('='.repeat(80) + '\n');

    let totalUnused = 0;

    for (const report of reports) {
        const unusedMethods = report.methods.filter(m => m.invocations === 0);

        if (unusedMethods.length === 0) {
            continue;
        }

        const relativePath = path.relative(process.cwd(), report.filePath);
        console.log(`\n${report.interfaceName} (${relativePath})`);
        console.log('-'.repeat(80));

        for (const method of unusedMethods) {
            const deprecatedTag = method.isDeprecated ? ' [DEPRECATED]' : '';

            console.log(
                `  ✗ ${method.name}:${method.lineNumber} - ` +
                `${method.implementations} impl, ${method.invocations} calls${deprecatedTag}`
            );
        }

        totalUnused += unusedMethods.length;
    }

    if (totalUnused === 0) {
        console.log('\n✅ No unused interface methods found!\n');
    } else {
        console.log('\n' + '='.repeat(80));
        console.log(`Summary: ${totalUnused} unused method(s) found`);
        console.log('='.repeat(80) + '\n');
        console.log('Recommendation: Consider removing unused methods from interfaces and implementations.\n');
    }
}

function main() {
    const projectRoot = process.cwd();
    const tsconfigPath = path.join(projectRoot, 'firebase', 'functions', 'tsconfig.json');

    console.log('Project root:', projectRoot);
    console.log('TypeScript config:', tsconfigPath);
    console.log('Target interfaces:', TARGET_INTERFACES.join(', '));

    try {
        const reports = analyzeProject(tsconfigPath);
        generateReport(reports);
    } catch (error) {
        console.error('Error analyzing project:', error);
        process.exit(1);
    }
}

main();

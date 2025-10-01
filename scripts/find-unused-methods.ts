#!/usr/bin/env tsx

import { Project, SyntaxKind, InterfaceDeclaration, ClassDeclaration } from 'ts-morph';
import * as path from 'path';

interface MethodInfo {
    name: string;
    interfaceName: string;
    filePath: string;
    lineNumber: number;
    implementations: number;
    invocations: number;
    testInvocations: number;
    productionInvocations: number;
    isDeprecated: boolean;
}

interface InterfaceReport {
    interfaceName: string;
    filePath: string;
    methods: MethodInfo[];
    isClass: boolean;
}

function isTestFile(filePath: string): boolean {
    return filePath.includes('/__tests__/') || filePath.includes('\\__tests__\\');
}

function isBuilderFile(filePath: string): boolean {
    return filePath.endsWith('Builder.ts');
}

function analyzeProject(tsconfigPath: string): InterfaceReport[] {
    console.log('Loading TypeScript project...');
    const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
    });

    const reports: InterfaceReport[] = [];

    console.log('Finding ALL interfaces and classes (excluding node_modules and tests)...');
    const sourceFiles = project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();

        if (filePath.includes('node_modules') || isTestFile(filePath) || isBuilderFile(filePath)) {
            continue;
        }

        // Analyze ALL interfaces
        const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
        for (const interfaceDecl of interfaces) {
            const interfaceName = interfaceDecl.getName();

            console.log(`\nAnalyzing interface: ${interfaceName}`);
            const methods = analyzeInterfaceMethods(interfaceDecl, project);

            if (methods.length > 0) {
                reports.push({
                    interfaceName,
                    filePath: sourceFile.getFilePath(),
                    methods,
                    isClass: false,
                });
            }
        }

        // Analyze ALL classes
        const classes = sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration);
        for (const classDecl of classes) {
            const className = classDecl.getName();

            if (!className) {
                continue;
            }

            console.log(`\nAnalyzing class: ${className}`);
            const methods = analyzeClassMethods(classDecl, project);

            if (methods.length > 0) {
                reports.push({
                    interfaceName: className,
                    filePath: sourceFile.getFilePath(),
                    methods,
                    isClass: true,
                });
            }
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
        const { total, test, production } = countInvocations(methodName, project);

        console.log(`  - ${methodName}: ${implementations} impl, ${production} prod calls, ${test} test calls${isDeprecated ? ' (DEPRECATED)' : ''}`);

        methods.push({
            name: methodName,
            interfaceName,
            filePath: sourceFile.getFilePath(),
            lineNumber,
            implementations,
            invocations: total,
            testInvocations: test,
            productionInvocations: production,
            isDeprecated,
        });
    }

    return methods;
}

function analyzeClassMethods(classDecl: ClassDeclaration, project: Project): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const className = classDecl.getName() || '';
    const sourceFile = classDecl.getSourceFile();

    const classMethods = classDecl.getMethods();

    for (const method of classMethods) {
        // Skip private methods and constructors
        if (method.hasModifier(SyntaxKind.PrivateKeyword) || method.getName() === 'constructor') {
            continue;
        }

        const methodName = method.getName();
        const lineNumber = method.getStartLineNumber();

        const jsDocs = method.getJsDocs();
        const isDeprecated = jsDocs.some(doc =>
            doc.getTags().some(tag => tag.getTagName() === 'deprecated')
        );

        const { total, test, production } = countInvocations(methodName, project);

        console.log(`  - ${methodName}: ${production} prod calls, ${test} test calls${isDeprecated ? ' (DEPRECATED)' : ''}`);

        methods.push({
            name: methodName,
            interfaceName: className,
            filePath: sourceFile.getFilePath(),
            lineNumber,
            implementations: 1, // The class itself is the implementation
            invocations: total,
            testInvocations: test,
            productionInvocations: production,
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

function countInvocations(methodName: string, project: Project): { total: number; test: number; production: number } {
    let testCount = 0;
    let productionCount = 0;

    for (const sourceFile of project.getSourceFiles()) {
        const filePath = sourceFile.getFilePath();

        if (filePath.includes('node_modules')) {
            continue;
        }

        const isTest = isTestFile(filePath);
        const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

        for (const callExpr of callExpressions) {
            const expression = callExpr.getExpression();

            if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
                const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
                const name = propAccess.getName();

                if (name === methodName) {
                    if (isTest) {
                        testCount++;
                    } else {
                        productionCount++;
                    }
                }
            }
        }
    }

    return {
        total: testCount + productionCount,
        test: testCount,
        production: productionCount
    };
}

function generateReport(reports: InterfaceReport[]): void {
    console.log('\n\n' + '='.repeat(80));
    console.log('UNUSED INTERFACE/CLASS METHODS REPORT');
    console.log('(Test invocations are ignored - only production code usage counts)');
    console.log('='.repeat(80) + '\n');

    let totalUnused = 0;

    for (const report of reports) {
        // Filter methods with 0 production invocations (test invocations don't count)
        const unusedMethods = report.methods.filter(m => m.productionInvocations === 0);

        if (unusedMethods.length === 0) {
            continue;
        }

        const relativePath = path.relative(process.cwd(), report.filePath);
        const typeLabel = report.isClass ? 'Class' : 'Interface';
        console.log(`\n${report.interfaceName} [${typeLabel}] (${relativePath})`);
        console.log('-'.repeat(80));

        for (const method of unusedMethods) {
            const deprecatedTag = method.isDeprecated ? ' [DEPRECATED]' : '';
            const testInfo = method.testInvocations > 0 ? ` (${method.testInvocations} test calls)` : '';

            if (report.isClass) {
                console.log(
                    `  ✗ ${method.name}:${method.lineNumber} - ` +
                    `${method.productionInvocations} prod calls${testInfo}${deprecatedTag}`
                );
            } else {
                console.log(
                    `  ✗ ${method.name}:${method.lineNumber} - ` +
                    `${method.implementations} impl, ${method.productionInvocations} prod calls${testInfo}${deprecatedTag}`
                );
            }
        }

        totalUnused += unusedMethods.length;
    }

    if (totalUnused === 0) {
        console.log('\n✅ No unused interface/class methods found!\n');
    } else {
        console.log('\n' + '='.repeat(80));
        console.log(`Summary: ${totalUnused} unused method(s) found (not counting test-only usage)`);
        console.log('='.repeat(80) + '\n');
        console.log('Recommendation: Consider removing unused methods from interfaces, classes, and implementations.\n');
    }
}

function main() {
    const projectRoot = process.cwd();
    const tsconfigPath = path.join(projectRoot, 'firebase', 'functions', 'tsconfig.json');

    console.log('Project root:', projectRoot);
    console.log('TypeScript config:', tsconfigPath);
    console.log('Analyzing ALL interfaces and classes in production code');
    console.log('Excluded from analysis: test files (__tests__/), builder files (*Builder.ts)');

    try {
        const reports = analyzeProject(tsconfigPath);
        generateReport(reports);
    } catch (error) {
        console.error('Error analyzing project:', error);
        process.exit(1);
    }
}

main();

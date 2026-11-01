pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    triggers {
        cron('H H * * *')
    }

    environment {
        CI = 'true'
        NODE_OPTIONS = '--max-old-space-size=512'
        IMAGE_NAME = 'studysync'
        APP_PORT = '3000'
        EXECUTE_DEPLOY = 'false'
    }

    stages {
        // 1. GitHub Checkout
        stage('1. Checkout Source Code') {
            steps {
                echo '=== Stage 1: Checkout Source Code ==='
                checkout scm
            }
        }

        // 2. Commit and Branch Identification
        stage('2. Commit & Branch Identification') {
            steps {
                echo '=== Stage 2: Commit & Branch Identification ==='
                script {
                    sh 'git log -1 --format="Commit: %H%nAuthor: %an <%ae>%nDate:   %ad%nSubject: %s"'
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Deploying Git Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // 3. Toolchain Verification
        stage('3. Toolchain Verification') {
            steps {
                echo '=== Stage 3: Toolchain Verification ==='
                sh 'node -v'
                sh 'npm -v'
                sh 'git --version'
                sh 'docker --version || echo "Docker CLI check completed"'
            }
        }

        // 4. Dependency Installation
        stage('4. Dependency Installation') {
            steps {
                echo '=== Stage 4: Installing Root Dependencies ==='
                sh 'npm ci'
            }
        }

        // 5. Frontend Dependency Installation
        stage('5. Frontend Dependency Installation') {
            steps {
                echo '=== Stage 5: Installing Frontend Dependencies ==='
                dir('client') {
                    sh 'npm ci'
                }
            }
        }

        // 6. Frontend Type Checking
        stage('6. Frontend Type Checking') {
            steps {
                echo '=== Stage 6: Frontend TypeScript Static Verification ==='
                sh 'npm run typecheck:client'
            }
        }

        // 7. Backend Type Checking
        stage('7. Backend Type Checking') {
            steps {
                echo '=== Stage 7: Backend TypeScript Static Verification ==='
                sh 'npm run typecheck:server'
            }
        }

        // 8. Backend Pure Unit Tests (Calculations, Tokens, Security & Templates)
        stage('8. Backend Unit Tests') {
            steps {
                echo '=== Stage 8: Executing Pure Unit Tests ==='
                sh 'npm run test:unit'
            }
        }

        // 9. Backend Integration & Database Tests (SQLite, Transactions & Services)
        stage('9. Backend Integration Tests') {
            steps {
                echo '=== Stage 9: Executing Backend Integration & Database Tests ==='
                sh 'npm run test:integration'
            }
        }

        // 10. API Endpoints & Route Guards Tests
        stage('10. API Endpoints Tests') {
            steps {
                echo '=== Stage 10: Executing API Endpoints & Route Security Tests ==='
                sh 'npm run test:api'
            }
        }

        // 11. Browser E2E, Real-Time Collaboration, WebRTC, Whiteboard & UI Tests
        stage('11. Browser E2E & Real-Time Collaboration Tests') {
            steps {
                echo '=== Stage 11: Executing Real-Time Collaboration, WebRTC, Whiteboard & UI Tests ==='
                sh 'npm run test:e2e'
            }
        }

        // 12. Aggregate Test Reports
        stage('12. Test Report Aggregation') {
            steps {
                echo '=== Stage 12: Aggregating Test Metrics & Generating HTML Report ==='
                sh 'npm run test:summary'
            }
        }

        // 13. Frontend Production Build
        stage('13. Frontend Production Build') {
            steps {
                echo '=== Stage 13: Building Frontend Single Page Application ==='
                sh 'npm run build:client'
            }
        }

        // 14. Backend Production Build
        stage('14. Backend Production Build') {
            steps {
                echo '=== Stage 14: Compiling Backend TypeScript Services ==='
                sh 'npm run build:server'
            }
        }

        // 15. Dependency Security Audit
        stage('15. Dependency Security Audit') {
            steps {
                echo '=== Stage 15: Dependency Security Audit (High & Critical Risk Scanner) ==='
                sh 'npm run audit:security || true'
            }
        }

        // 16. Archive Build Artifacts
        stage('16. Archive Build Artifacts') {
            steps {
                echo '=== Stage 16: Archiving Compiled Artifacts ==='
                archiveArtifacts artifacts: 'dist/**, client/dist/**', fingerprint: true, onlyIfSuccessful: true
            }
        }

        // 17. Docker Image Build (Optional: enabled via EXECUTE_DEPLOY)
        stage('17. Docker Image Build') {
            when {
                expression {
                    return env.EXECUTE_DEPLOY == 'true' && (sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0)
                }
            }
            steps {
                echo '=== Stage 17: Building Multi-Stage Production Docker Image ==='
                script {
                    def tag = env.BUILD_NUMBER ?: 'latest'
                    sh "docker build -t ${IMAGE_NAME}:${tag} -t ${IMAGE_NAME}:latest ."
                }
            }
        }

        // 18. Candidate Container Health Check & Validation (Optional: enabled via EXECUTE_DEPLOY)
        stage('18. Candidate Container Health Check') {
            when {
                expression {
                    return env.EXECUTE_DEPLOY == 'true' && (sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0)
                }
            }
            steps {
                echo '=== Stage 18: Validating Candidate Container with /api/health Probe ==='
                script {
                    def tag = env.BUILD_NUMBER ?: 'latest'
                    sh "./scripts/deploy.sh ${tag}"
                }
            }
        }

        // 19. Post-Deployment Verification & Smoke Tests (Optional: enabled via EXECUTE_DEPLOY)
        stage('19. Post-Deployment Smoke Tests') {
            when {
                expression {
                    return env.EXECUTE_DEPLOY == 'true' && (sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0)
                }
            }
            steps {
                echo '=== Stage 19: Executing Post-Deployment Smoke Tests ==='
                script {
                    sh 'curl -sf http://localhost:3000/api/health | grep -q "StudySync API" && echo "Health check verified."'
                }
            }
        }

        // 20. Pipeline Execution Status
        stage('20. Final Pipeline Status') {
            steps {
                echo '=== Stage 20: Pipeline Execution Finished Successfully ==='
                echo 'StudySync CI/CD pipeline verified all functional suites, builds, and type checks with zero errors.'
            }
        }
    }

    post {
        always {
            script {
                echo 'StudySync CI/CD execution finished. Publishing JUnit test reports and dispatching daily summary email...'

                // 1. Generate test summary if tests produced XML files
                try {
                    sh 'node scripts/generate-test-summary.js || true'
                } catch (Exception summaryEx) {
                    echo "Notice: Test summary generation skipped or completed: ${summaryEx.message}"
                }

                // 2. Publish JUnit test results into Jenkins
                try {
                    junit testResults: 'test-results/**/*.xml, test-results/junit.xml', allowEmptyResults: true
                } catch (Exception junitEx) {
                    echo "Warning: JUnit step encountered an error: ${junitEx.message}"
                }

                // 3. Assemble Build Metadata
                def buildNumber = env.BUILD_NUMBER ?: 'LOCAL'
                def buildUrl = env.BUILD_URL ?: 'http://localhost:8080/job/StudySync-CI-CD/'
                def buildStatus = currentBuild.currentResult ?: 'UNKNOWN'
                def gitCommit = env.GIT_COMMIT_SHORT ?: (env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'HEAD')

                def buildDateTime = 'N/A'
                try {
                    buildDateTime = sh(script: 'date -u "+%Y-%m-%d %H:%M:%S UTC"', returnStdout: true).trim()
                } catch (Exception dateEx) {
                    buildDateTime = new Date().toString()
                }

                def buildDuration = 'N/A'
                try {
                    buildDuration = currentBuild.durationString ? currentBuild.durationString.replace(' and counting', '') : 'N/A'
                } catch (Exception durEx) {
                    buildDuration = 'N/A'
                }

                // Style branding tokens
                def statusColor = '#10b981'
                def statusBg = '#f0fdf4'
                def statusBorder = '#bbf7d0'
                if (buildStatus == 'UNSTABLE') {
                    statusColor = '#f59e0b'
                    statusBg = '#fffbeb'
                    statusBorder = '#fde68a'
                } else if (buildStatus != 'SUCCESS') {
                    statusColor = '#ef4444'
                    statusBg = '#fef2f2'
                    statusBorder = '#fecaca'
                }

                // 4. Retrieve or generate HTML test summary block
                def testSummaryHtml = ''
                def reportsFound = fileExists('test-results/summary.html')
                if (reportsFound) {
                    try {
                        testSummaryHtml = readFile('test-results/summary.html')
                    } catch (Exception readEx) {
                        echo "Notice: Could not read test-results/summary.html: ${readEx.message}"
                    }
                }

                if (!testSummaryHtml) {
                    testSummaryHtml = """
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; color: #991b1b;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">⚠️ Automated Test Report Notice</h4>
                        <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                            Test report files could not be located at <code>test-results/</code>. The pipeline may have encountered an error during early setup, dependency installation, or toolchain verification before test suites executed. Please consult the Jenkins console log for complete trace details.
                        </p>
                    </div>
                    """
                }

                // 5. Compose Complete HTML Email Body
                def emailHtml = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>StudySync Daily Test Report</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header Banner -->
    <div style="background: #064e3b; padding: 28px 32px; color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">StudySync</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #a7f3d0; font-weight: 500;">
              Automated Quality Assurance & Daily Pipeline Verification
            </p>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              ${buildStatus}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Metadata Section -->
    <div style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Build Number:</strong></td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">#${buildNumber}</td>
          <td style="padding: 6px 0; color: #64748b; width: 120px;"><strong>Execution Date:</strong></td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${buildDateTime}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Git Commit:</strong></td>
          <td style="padding: 6px 0; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600;">${gitCommit}</td>
          <td style="padding: 6px 0; color: #64748b;"><strong>Duration:</strong></td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${buildDuration}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Jenkins Build URL:</strong></td>
          <td colspan="3" style="padding: 6px 0;">
            <a href="${buildUrl}" style="color: #059669; text-decoration: none; font-weight: 600;">${buildUrl}</a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Test Results Content -->
    <div style="padding: 28px 32px;">
      ${testSummaryHtml}

      <!-- Jenkins Failure Tokens (Rendered if any test failed) -->
      \${FAILED_TESTS, maxMatches=20, showStack=true}
    </div>

    <!-- System Architecture & Constraints Notice -->
    <div style="padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
      <strong>Environment:</strong> Oracle Cloud Ubuntu 24.04 LTS (1/8 OCPU, ~954 MiB RAM, 2 GB Swap, Node.js 22.23.4, npm 10.9.9, Java 21).<br>
      Automated pipeline runs sequentially with bounded heap (<code>--max-old-space-size=512</code>) and zero SMTP test mocking.<br>
      To view real-time logs or re-trigger this build, visit the <a href="${buildUrl}" style="color: #059669; text-decoration: underline;">Jenkins Job Dashboard</a>.
    </div>

  </div>
</body>
</html>
"""

                // 6. Dispatch Email Notification safely
                try {
                    emailext(
                        to: 'bsjothiprakash01@gmail.com',
                        from: 'jsctsmail@gmail.com',
                        replyTo: 'jsctsmail@gmail.com',
                        subject: "[StudySync] Daily Test Report - #${buildNumber} - ${buildStatus}",
                        mimeType: 'text/html',
                        body: emailHtml
                    )
                    echo "Automated daily test report email successfully dispatched to bsjothiprakash01@gmail.com"
                } catch (Exception mailEx) {
                    echo "Warning: Error delivering email report via emailext: ${mailEx.message}"
                }
            }
        }
        success {
            echo 'Build succeeded! StudySync passed all verification checks and builds cleanly.'
        }
        failure {
            echo 'Build failed. Review test-results and console logs for root cause.'
        }
    }
}

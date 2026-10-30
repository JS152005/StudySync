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
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== Stage 1: Checkout Source Code ==='
                checkout scm
            }
        }

        stage('Environment Verification') {
            steps {
                echo '=== Stage 2: Environment Verification ==='
                sh 'node -v'
                sh 'npm -v'
                sh 'git --version'
            }
        }

        stage('Install Root Dependencies') {
            steps {
                echo '=== Stage 3: Installing Root Dependencies ==='
                sh 'npm ci'
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                echo '=== Stage 4: Installing Frontend Dependencies ==='
                dir('client') {
                    sh 'npm ci'
                }
            }
        }

        stage('Run Tests') {
            steps {
                echo '=== Stage 5: Running Automated Tests ==='
                sh 'npm test'
            }
        }

        stage('Build Frontend and Backend') {
            steps {
                echo '=== Stage 6: Building Frontend and Backend ==='
                sh 'npm run build'
            }
        }

        stage('Archive Build Artifacts') {
            steps {
                echo '=== Stage 7: Archiving Build Artifacts ==='
                archiveArtifacts artifacts: 'dist/**, client/dist/**', fingerprint: true, onlyIfSuccessful: true
            }
        }

        stage('Final Pipeline Status') {
            steps {
                echo '=== Stage 8: Pipeline Execution Finished Successfully ==='
                echo 'StudySync CI pipeline completed all stages successfully.'
            }
        }
    }

    post {
        always {
            echo 'StudySync CI pipeline run completed.'
            junit testResults: 'test-results/junit.xml', allowEmptyResults: true
            script {
                def buildNumber = env.BUILD_NUMBER ?: 'UNKNOWN'
                def buildUrl = env.BUILD_URL ?: ''
                def buildStatus = currentBuild.currentResult ?: 'UNKNOWN'
                def reportExists = fileExists('test-results/junit.xml')

                def buildDateTime = 'N/A'
                try {
                    buildDateTime = sh(script: 'date -u "+%Y-%m-%d %H:%M:%S UTC"', returnStdout: true).trim()
                } catch (Exception e) {
                    buildDateTime = new Date().toString()
                }

                def gitCommit = env.GIT_COMMIT ?: ''
                if (!gitCommit) {
                    try {
                        gitCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    } catch (Exception e) {
                        gitCommit = 'N/A'
                    }
                } else if (gitCommit.length() > 7) {
                    gitCommit = gitCommit.substring(0, 7)
                }

                def buildDuration = 'N/A'
                try {
                    buildDuration = currentBuild.durationString ? currentBuild.durationString.replace(' and counting', '') : 'N/A'
                } catch (Exception e) {
                    buildDuration = 'N/A'
                }

                def statusHeaderBg = '#059669'
                def statusTextColor = '#059669'
                def statusBadgeBg = 'rgba(255, 255, 255, 0.25)'
                def statusBadgeText = '#ffffff'

                if (buildStatus == 'UNSTABLE') {
                    statusHeaderBg = '#d97706'
                    statusTextColor = '#d97706'
                } else if (buildStatus != 'SUCCESS') {
                    statusHeaderBg = '#dc2626'
                    statusTextColor = '#dc2626'
                }

                def testReportContent = ''
                if (reportExists) {
                    def failureSection = ''
                    if (buildStatus != 'SUCCESS') {
                        failureSection = """
                        <div style="margin-top: 16px; background-color: #fef2f2; border: 1px solid #f87171; border-radius: 8px; padding: 16px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #991b1b;">
                                Test Failure Details
                            </h3>
                            <p style="margin: 0 0 10px 0; font-size: 13px; color: #7f1d1d;">
                                One or more automated tests failed during execution. Review the failure diagnostics below:
                            </p>
                            <pre style="margin: 0; background-color: #ffffff; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #991b1b; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">\${FAILED_TESTS, showStack="true", showMessage="true", maxTests=15}</pre>
                        </div>
                        """
                    } else {
                        failureSection = """
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-top: 14px;">
                            <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 500;">
                                &#10004; All automated test assertions passed cleanly with zero regressions.
                            </p>
                        </div>
                        """
                    }

                    testReportContent = """
                    <h2 style="margin: 0 0 14px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
                        Automated Test Results Summary
                    </h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                        <tr>
                            <td width="23%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                                <span style="font-size: 22px; font-weight: 700; color: #2563eb; display: block;">\${TEST_COUNTS, var="total"}</span>
                                <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total</span>
                            </td>
                            <td width="3%"></td>
                            <td width="23%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
                                <span style="font-size: 22px; font-weight: 700; color: #16a34a; display: block;">\${TEST_COUNTS, var="pass"}</span>
                                <span style="font-size: 11px; font-weight: 600; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Passed</span>
                            </td>
                            <td width="3%"></td>
                            <td width="23%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                                <span style="font-size: 22px; font-weight: 700; color: #dc2626; display: block;">\${TEST_COUNTS, var="fail"}</span>
                                <span style="font-size: 11px; font-weight: 600; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.5px;">Failed</span>
                            </td>
                            <td width="3%"></td>
                            <td width="23%" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 12px; text-align: center;">
                                <span style="font-size: 22px; font-weight: 700; color: #ca8a04; display: block;">\${TEST_COUNTS, var="skip"}</span>
                                <span style="font-size: 11px; font-weight: 600; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px;">Skipped</span>
                            </td>
                        </tr>
                    </table>
                    ${failureSection}
                    """
                } else {
                    testReportContent = """
                    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                <td valign="top" style="padding-right: 12px; font-size: 20px;">&#9888;</td>
                                <td>
                                    <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #92400e;">
                                        Automated Test Report Not Generated
                                    </h3>
                                    <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">
                                        The test report file (<code>test-results/junit.xml</code>) could not be generated or found.
                                        The pipeline may have failed in an earlier stage (such as dependency installation or checkout) prior to running the test suite.
                                        Please inspect the build console output for detailed diagnostic logs.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </div>
                    """
                }

                def emailHtml = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>StudySync Daily Test Report</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 0;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="background-color: ${statusHeaderBg}; padding: 28px 32px; text-align: left;">
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                <tr>
                                                    <td>
                                                        <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${statusBadgeText}; background-color: ${statusBadgeBg}; padding: 4px 10px; border-radius: 20px; margin-bottom: 8px;">
                                                            ${buildStatus}
                                                        </span>
                                                        <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: #ffffff;">StudySync</h1>
                                                        <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.9);">Daily Automated Test &amp; CI/CD Report</p>
                                                    </td>
                                                    <td align="right" valign="top">
                                                        <span style="font-size: 14px; font-weight: 600; color: #ffffff; background-color: rgba(255, 255, 255, 0.2); padding: 6px 12px; border-radius: 8px; display: inline-block;">
                                                            Build #${buildNumber}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding: 28px 32px;">
                                            ${testReportContent}

                                            <h2 style="margin: 24px 0 12px 0; font-size: 16px; font-weight: 600; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                                                Pipeline Execution Details
                                            </h2>
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; border-collapse: collapse;">
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b; width: 140px;"><strong>Project:</strong></td>
                                                    <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">StudySync</td>
                                                </tr>
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Build Number:</strong></td>
                                                    <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">#${buildNumber}</td>
                                                </tr>
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Build Status:</strong></td>
                                                    <td style="padding: 10px 0; color: ${statusTextColor}; font-weight: 700;">${buildStatus}</td>
                                                </tr>
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Date &amp; Time:</strong></td>
                                                    <td style="padding: 10px 0; color: #0f172a;">${buildDateTime}</td>
                                                </tr>
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Duration:</strong></td>
                                                    <td style="padding: 10px 0; color: #0f172a;">${buildDuration}</td>
                                                </tr>
                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Git Commit:</strong></td>
                                                    <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">${gitCommit}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 10px 0; color: #64748b;"><strong>Jenkins URL:</strong></td>
                                                    <td style="padding: 10px 0;"><a href="${buildUrl}" style="color: #2563eb; text-decoration: none; word-break: break-all;">${buildUrl}</a></td>
                                                </tr>
                                            </table>

                                            <div style="margin-top: 28px; text-align: center;">
                                                <a href="${buildUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
                                                    View Full Build in Jenkins
                                                </a>
                                            </div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                                            <p style="margin: 0;">Automated test report generated by StudySync CI/CD Pipeline on Oracle Cloud Ubuntu.</p>
                                            <p style="margin: 4px 0 0 0;">Sender: jsctsmail@gmail.com &bull; Recipient: bsjothiprakash01@gmail.com</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """

                try {
                    emailext(
                        to: 'bsjothiprakash01@gmail.com',
                        from: 'jsctsmail@gmail.com',
                        replyTo: 'jsctsmail@gmail.com',
                        subject: "[StudySync] Daily Test Report - #${buildNumber} - ${buildStatus}",
                        mimeType: 'text/html',
                        body: emailHtml
                    )
                    echo 'Daily test report email sent successfully to bsjothiprakash01@gmail.com.'
                } catch (Exception emailErr) {
                    echo "WARNING: Failed to deliver email report via emailext: ${emailErr.message}"
                }
            }
        }
        success {
            echo '========================================='
            echo ' StudySync CI Pipeline Status: SUCCESS'
            echo ' All tests and builds completed cleanly.'
            echo '========================================='
        }
        failure {
            echo '========================================='
            echo ' StudySync CI Pipeline Status: FAILURE'
            echo ' Pipeline execution failed.'
            echo '========================================='
        }
    }
}

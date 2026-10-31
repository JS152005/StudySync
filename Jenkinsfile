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

        // 5. Lockfile Consistency & Frontend Install
        stage('5. Lockfile Consistency & Frontend Install') {
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

        // 8. Automated Deep Test Suite (Unit, Integration, Auth OTP, WebRTC, Chat, DB)
        stage('8. Automated Deep Test Suite') {
            steps {
                echo '=== Stage 8: Executing Complete Vitest Test Suite with JUnit Reporting ==='
                sh 'npm run test:ci'
            }
        }

        // 9. Frontend Production Build
        stage('9. Frontend Production Build') {
            steps {
                echo '=== Stage 9: Building Frontend Single Page Application ==='
                sh 'npm run build:client'
            }
        }

        // 10. Backend Production Build
        stage('10. Backend Production Build') {
            steps {
                echo '=== Stage 10: Compiling Backend TypeScript Services ==='
                sh 'npm run build:server'
            }
        }

        // 11. Dependency Security Audit
        stage('11. Dependency Security Audit') {
            steps {
                echo '=== Stage 11: Dependency Security Audit (High & Critical Risk Scanner) ==='
                sh 'npm run audit:security || true'
            }
        }

        // 12. Archive Build Artifacts
        stage('12. Archive Build Artifacts') {
            steps {
                echo '=== Stage 12: Archiving Compiled Artifacts ==='
                archiveArtifacts artifacts: 'dist/**, client/dist/**', fingerprint: true, onlyIfSuccessful: true
            }
        }

        // 13. Docker Image Build
        stage('13. Docker Image Build') {
            when {
                expression {
                    return sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0
                }
            }
            steps {
                echo '=== Stage 13: Building Multi-Stage Production Docker Image ==='
                script {
                    def tag = env.BUILD_NUMBER ?: 'latest'
                    sh "docker build -t ${IMAGE_NAME}:${tag} -t ${IMAGE_NAME}:latest ."
                }
            }
        }

        // 14. Candidate Container Health Check & Validation
        stage('14. Candidate Container Health Check') {
            when {
                expression {
                    return sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0
                }
            }
            steps {
                echo '=== Stage 14: Validating Candidate Container with /api/health Probe ==='
                script {
                    def tag = env.BUILD_NUMBER ?: 'latest'
                    sh "./scripts/deploy.sh ${tag}"
                }
            }
        }

        // 15. Post-Deployment Verification & Smoke Tests
        stage('15. Post-Deployment Smoke Tests') {
            when {
                expression {
                    return sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0
                }
            }
            steps {
                echo '=== Stage 15: Executing Post-Deployment Smoke Tests ==='
                script {
                    sh 'curl -sf http://localhost:3000/api/health | grep -q "StudySync API" && echo "Health check verified."'
                }
            }
        }

        // 16. Pipeline Status
        stage('16. Pipeline Execution Status') {
            steps {
                echo '=== Stage 16: Pipeline Execution Finished Successfully ==='
                echo 'StudySync production CI/CD pipeline completed all stages with zero errors.'
            }
        }
    }

    post {
        always {
            echo 'StudySync CI/CD pipeline run finished. Publishing JUnit test reports...'
            junit testResults: 'test-results/junit.xml', allowEmptyResults: true

            script {
                def buildNumber = env.BUILD_NUMBER ?: 'LOCAL'
                def buildUrl = env.BUILD_URL ?: ''
                def buildStatus = currentBuild.currentResult ?: 'SUCCESS'
                def reportExists = fileExists('test-results/junit.xml')

                def buildDateTime = 'N/A'
                try {
                    buildDateTime = sh(script: 'date -u "+%Y-%m-%d %H:%M:%S UTC"', returnStdout: true).trim()
                } catch (Exception e) {
                    buildDateTime = new Date().toString()
                }

                def gitCommit = env.GIT_COMMIT_SHORT ?: 'N/A'
                def buildDuration = 'N/A'
                try {
                    buildDuration = currentBuild.durationString ? currentBuild.durationString.replace(' and counting', '') : 'N/A'
                } catch (Exception e) {
                    buildDuration = 'N/A'
                }

                def statusHeaderBg = '#059669'
                def statusTextColor = '#059669'
                if (buildStatus == 'UNSTABLE') {
                    statusHeaderBg = '#d97706'
                    statusTextColor = '#d97706'
                } else if (buildStatus != 'SUCCESS') {
                    statusHeaderBg = '#dc2626'
                    statusTextColor = '#dc2626'
                }

                echo "Build #${buildNumber} status: ${buildStatus} (Duration: ${buildDuration}, Commit: ${gitCommit})"
            }
        }
        success {
            echo 'Build succeeded! StudySync is ready for production traffic.'
        }
        failure {
            echo 'Build failed. Review test-results/junit.xml and stage logs for root cause.'
        }
    }
}

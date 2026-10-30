pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
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
        always {
            echo 'StudySync CI pipeline run completed.'
        }
    }
}

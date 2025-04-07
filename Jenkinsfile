pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        KUBE_NAMESPACE = "crda-namespace"
        MYSQL_SECRET = "mysql-secret"
        SONAR_PROJECT_KEY = "najwa22_crda-app"
        SONAR_SERVER_URL = "http://localhost:9000"
        SONAR_TOKEN_CREDENTIALS_ID = "sonarqube-token"
    }

    options {
    timeout(time: 60, unit: 'MINUTES')
    disableConcurrentBuilds()
    }
    
    stages {
        stage('Checkout SCM') {
            steps {
                git url: 'https://github.com/najwa2222/crda-pipeline.git', branch: 'main'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                bat 'npm ci --prefer-offline --no-audit --no-fund'
            }
        }
        
        stage('Static Code Analysis') {
            steps {
                bat 'npm run lint'
            }
        }

        stage('Test Existence Check') {
            steps {
                bat 'if not exist "test" (echo No test directory found && exit /b 1)'
                bat 'dir test /s'
            }
        }

        stage('Unit Tests') {
            steps {
                bat '''
                    @echo off
                    :: Force directory creation with Windows path handling
                    if not exist "test-results" mkdir test-results
                    if not exist "coverage" mkdir coverage
                    
                    :: Run tests with error level checking
                    call npm run test:ci || exit /b 1
                    call npm run test:coverage || exit /b 1
                    
                    :: Verify artifact generation
                    if not exist "test-results\\results.xml" (
                        echo Missing test results file! && exit /b 1
                    )
                    if not exist "coverage\\lcov.info" (
                        echo Missing coverage data! && exit /b 1
                    )
                    '''
            }
            post {
                always {
                    junit testResults: 'test-results/**/*.xml', allowEmptyResults: true
                    cobertura coberturaReportFile: 'coverage/cobertura-coverage.xml', onlyStable: false
                    bat 'dir /s /b test-results'
                    bat 'type coverage\\lcov.info'
                    bat 'type test-results\\results.xml'
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    withCredentials([string(credentialsId: SONAR_TOKEN_CREDENTIALS_ID, variable: 'SONAR_TOKEN')]) {
                        bat """
                            sonar-scanner.bat ^
                            -Dsonar.projectKey=${SONAR_PROJECT_KEY} ^
                            -Dsonar.projectName=${DOCKER_IMAGE} ^
                            -Dsonar.sources=app.js,controllers,models,routes,utils ^
                            -Dsonar.host.url=${SONAR_SERVER_URL} ^
                            -Dsonar.login=${SONAR_TOKEN} ^
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info ^
                            -Dsonar.tests=test ^
                            -Dsonar.testExecutionReportPaths=test-results/results.xml ^
                            -Dsonar.coverage.exclusions=**/test/**,**/node_modules/** ^
                            -Dsonar.qualitygate.wait=true ^
                            -Dsonar.exclusions=**/*.spec.js,**/*.test.js,public/**,kubernetes/**
                        """
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    dockerImage = docker.build("${DOCKER_IMAGE}:${DOCKER_TAG}")
                }
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    script {
                        docker.withRegistry('', 'dockerhub-credentials') {
                            dockerImage.push()
                            dockerImage.push('latest')
                        }
                    }
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    // Create namespace if not exists
                    bat "kubectl create namespace ${KUBE_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -"
                    
                    // Create secret with both passwords
                    withCredentials([
                        string(credentialsId: 'mysql-root-password', variable: 'MYSQL_ROOT_PASSWORD'),
                        string(credentialsId: 'mysql-app-password', variable: 'MYSQL_APP_PASSWORD')
                    ]) {
                        bat """
                            kubectl create secret generic ${MYSQL_SECRET} ^
                                --namespace ${KUBE_NAMESPACE} ^
                                --from-literal=root-password=${MYSQL_ROOT_PASSWORD} ^
                                --from-literal=app-password=${MYSQL_APP_PASSWORD} ^
                                --dry-run=client -o yaml | kubectl apply -f -
                        """
                    }
                    
                    // Apply all manifests in order
                    dir('kubernetes') {
                        def manifestOrder = [
                            '00-namespace.yaml',
                            '02-mysql-pv.yaml',
                            '03-mysql-pvc.yaml',
                            '04-mysql-init-script.yaml',
                            '05-mysql-deployment.yaml',
                            '06-mysql-service.yaml',
                            '07-app-deployment.yaml',
                            '08-app-service.yaml'
                        ]
                        
                        manifestOrder.each { file ->
                            bat "kubectl apply -f ${file} --namespace ${KUBE_NAMESPACE}"
                            if (file =~ /deployment.yaml$/) {
                                def resourceType = file.contains('mysql') ? 'deployment/mysql-deployment' : 'deployment/app-deployment'
                                bat "kubectl rollout status ${resourceType} --namespace ${KUBE_NAMESPACE} --timeout=300s"
                            }
                        }
                    }
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                script {
                    bat """
                        kubectl get pods,svc,deployments --namespace ${KUBE_NAMESPACE}
                        kubectl rollout status deployment/app-deployment --namespace ${KUBE_NAMESPACE} --timeout=120s
                    """
                }
            }
        }
    }
    
    post {
        always {
            echo 'Cleaning workspace'
            // Archive test results regardless of build result
            junit allowEmptyResults: true, testResults: 'test-results/**/*.xml'
            // Archive coverage reports regardless of build result
            archiveArtifacts allowEmptyArchive: true, artifacts: 'coverage/**'
            // Clean workspace at the end
            cleanWs()
        }
        failure {
           // Save logs for debugging
            archiveArtifacts allowEmptyArchive: true, artifacts: 'npm-debug.log*'
            slackSend(
                color: 'danger',
                message: "Failed build: ${env.JOB_NAME} #${env.BUILD_NUMBER} - Check console output for details",
                channel: '#jenkins-builds',
                tokenCredentialId: 'slack-token'
            )
        }
        success {
            slackSend(
            color: 'good',
            message: "Successful build: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            channel: '#jenkins-builds',
            tokenCredentialId: 'slack-token'
            )
        }
    }
}
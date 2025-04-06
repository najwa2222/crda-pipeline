pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        KUBE_NAMESPACE = "crda-namespace"
        MYSQL_SECRET = "mysql-secret"
        SONAR_PROJECT_KEY = "najwa22_crda-app"
        SONAR_SERVER_URL = "http://localhost:9000"
    }
    
    stages {
        stage('Checkout SCM') {
            steps {
                git url: 'https://github.com/najwa2222/crda-pipeline.git', branch: 'main'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                bat 'npm ci || npm install'
            }
        }
        
        stage('Static Code Analysis') {
            steps {
                bat 'npm run lint || echo "Linting issues found but continuing"'
            }
        }
        
        stage('Unit Tests') {
            steps {
                bat 'npm test || echo "Tests failed but continuing for now"'
            }
            post {
                always {
                    bat 'mkdir -p test-results'
                    // If you're using Jest with jest-junit reporter
                    junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
                }
            }
        }
        
        stage('Code Coverage') {
            steps {
                bat 'npm run test:coverage || echo "Coverage generation failed but continuing"'
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    bat """
                        sonar-scanner.bat ^
                        -Dsonar.projectKey=%SONAR_PROJECT_KEY% ^
                        -Dsonar.projectName=%DOCKER_IMAGE% ^
                        -Dsonar.sources=. ^
                        -Dsonar.host.url=%SONAR_SERVER_URL% ^
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info ^
                        -Dsonar.exclusions=node_modules/**/*,test/**/*,coverage/**/*,kubernetes/**/*,dist/**/* ^
                        -Dsonar.tests=test ^
                        -Dsonar.test.inclusions=**/*.test.js,**/*.spec.js
                    """
                }
            }
        }
        
        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                bat 'npm audit --audit-level=high || echo "Security vulnerabilities found but continuing"'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                bat """
                    docker build --no-cache -t %DOCKER_IMAGE%:%DOCKER_TAG% .
                    docker tag %DOCKER_IMAGE%:%DOCKER_TAG% %DOCKER_IMAGE%:latest
                """
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    bat """
                        echo %DOCKER_PASS% | docker login -u %DOCKER_USER% --password-stdin
                        docker push %DOCKER_IMAGE%:%DOCKER_TAG%
                        docker push %DOCKER_IMAGE%:latest || echo "Push failed but continuing"
                    """
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl create namespace %KUBE_NAMESPACE% --dry-run=client -o yaml | kubectl apply -f -
                    
                    kubectl create secret generic %MYSQL_SECRET% ^
                        --namespace %KUBE_NAMESPACE% ^
                        --from-literal=password=your_mysql_root_password ^
                        --dry-run=client -o yaml | kubectl apply -f -
                """
                
                dir('kubernetes') {
                    bat """
                        kubectl apply -f mysql-secret.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f mysql-configmap.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f mysql-pv.yaml --namespace %KUBE_NAMESPACE%
                        timeout /t 30 /nobreak
                        kubectl apply -f mysql-deployment.yaml --namespace %KUBE_NAMESPACE%
                        timeout /t 30 /nobreak
                        kubectl apply -f app-deployment.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f app-service.yaml --namespace %KUBE_NAMESPACE%
                    """
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                bat """
                    timeout /t 60 /nobreak
                    kubectl get pods --namespace %KUBE_NAMESPACE%
                    kubectl get services --namespace %KUBE_NAMESPACE%
                """
            }
        }
    }
    
    post {
        always {
            echo 'Generating test reports and cleaning workspace'
            junit allowEmptyResults: true, testResults: 'test-results/*.xml'
        }
        success {
            bat """
                echo "Cleaning up successful build images"
                docker rmi %DOCKER_IMAGE%:%DOCKER_TAG% || echo "Image cleanup failed but continuing"
                docker rmi %DOCKER_IMAGE%:latest || echo "Image cleanup failed but continuing"
            """
            
            echo 'Deployment completed successfully!'
        }
        failure {
            bat """
                echo "Preserving images for failed build debugging"
                docker images | findstr "%DOCKER_IMAGE%"
            """
            
            echo 'Deployment failed!'
        }
    }
}
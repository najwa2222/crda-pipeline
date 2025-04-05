pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        KUBE_NAMESPACE = "crda-namespace"
        MYSQL_SECRET = "mysql-secret"
    }

    stages {
        stage('Checkout SCM') {
            steps {
                git url: 'https://github.com/najwa2222/crda-pipeline.git', branch: 'main'
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
    }

    post {
        success {
            bat """
                echo "Cleaning up successful build images"
                docker rmi %DOCKER_IMAGE%:%DOCKER_TAG%
                docker rmi %DOCKER_IMAGE%:latest
            """
        }
        failure {
            bat """
                echo "Preserving images for failed build debugging"
                docker images | findstr "%DOCKER_IMAGE%"
            """
        }
    }
}